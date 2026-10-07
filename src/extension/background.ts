import { localMockAiProvider, type AiDraftProvider } from '../automation/aiProvider'
import { createGatewayAiProvider, normalizeGatewayUrl } from '../ai/gatewayProvider'
import type { AiGatewaySettings, AiHealthResponse } from '../ai/contracts'
import type { CandidateState, ReviewCandidate } from '../automation/model'
import { getCandidate, listCandidates, patchCandidate, upsertCandidate, clearCandidates } from '../automation/reviewStore'
import { assertTransition } from '../automation/stateMachine'
import { AutomationError, classifyAutomationError } from '../automation/errors'
import { isSupportedFacebookUrl } from '../core/helpers'
import { claimDueJobs, clearQueue, countJobs, enqueueJob, listJobs, updateJob } from './queue'
import { acquireLock, releaseLock } from '../runtime/locks'
import { clearRuntimeEvents, listRuntimeEvents, logRuntimeEvent } from '../runtime/events'
import { deleteSchedule, listSchedules, markScheduleRun, scheduleCanRun, upsertSchedule } from '../runtime/schedules'
import { computeBackoffMs } from '../runtime/retry'
import type { ReviewSchedule, RuntimeEvent } from '../runtime/types'
import { ensureDefaultSettings, getSafetyState, setEmergencyStop, getSettings, getSessionActionCount, incrementSessionActionCount, getAiGatewaySettings, saveAiGatewaySettings, getAiGatewayToken, setAiGatewayToken } from './storage'
import type {
  BackgroundRequest,
  ContentRequest,
  ExtensionResponse,
  FeedPost,
  PrepareCommentResult,
  QueueJob,
  RuntimeStatus,
  AiSettingsView,
} from './types'

const QUEUE_ALARM = 'autotool.queue.tick'
const WORKER_ID = `service-worker:${chrome.runtime.id}`
let activePreparationCandidateId: string | null = null

async function getFacebookTab(): Promise<chrome.tabs.Tab | undefined> {
  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true })
  const activeFacebook = currentWindowTabs.find((tab) => tab.active && isSupportedFacebookUrl(tab.url))
  if (activeFacebook) return activeFacebook
  const currentFacebook = currentWindowTabs.find((tab) => isSupportedFacebookUrl(tab.url))
  if (currentFacebook) return currentFacebook
  const allTabs = await chrome.tabs.query({})
  return allTabs.find((tab) => isSupportedFacebookUrl(tab.url))
}

async function sendToContent<T>(tabId: number, request: ContentRequest): Promise<ExtensionResponse<T>> {
  try {
    return await chrome.tabs.sendMessage(tabId, request) as ExtensionResponse<T>
  } catch {
    return { ok: false, error: 'Content script chưa sẵn sàng trên tab này. Hãy tải lại trang rồi thử lại.' }
  }
}

async function getAiProvider(): Promise<AiDraftProvider> {
  const settings = await getAiGatewaySettings()
  if (settings.mode === 'local') return localMockAiProvider
  return createGatewayAiProvider(settings, await getAiGatewayToken())
}

async function getAiSettingsView(): Promise<AiSettingsView> {
  const [settings, token] = await Promise.all([getAiGatewaySettings(), getAiGatewayToken()])
  return { settings, hasToken: Boolean(token) }
}

async function testGatewayConnection(): Promise<AiHealthResponse> {
  const settings = await getAiGatewaySettings()
  if (settings.mode !== 'gateway') throw new Error('AI mode hiện tại đang là local.')
  const token = await getAiGatewayToken()
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), settings.timeoutMs)
  try {
    const response = await fetch(`${normalizeGatewayUrl(settings.gatewayUrl)}/health`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`AI gateway HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`)
    const data = await response.json() as Partial<AiHealthResponse>
    if (!data.ok || typeof data.provider !== 'string' || typeof data.model !== 'string' || typeof data.version !== 'string') {
      throw new Error('AI gateway health response không hợp lệ.')
    }
    return data as AiHealthResponse
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

async function ensureAutomationAllowed(): Promise<void> {
  const safety = await getSafetyState()
  if (safety.emergencyStop) {
    throw new AutomationError('EMERGENCY_STOP', 'Emergency Stop đang bật. Tắt Emergency Stop trước khi tiếp tục.')
  }
}

async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const activeTab = await getFacebookTab()
  const candidates = await listCandidates(['READY_FOR_REVIEW', 'APPROVED', 'PREPARING'])
  const [settings, sessionActions, schedules, events] = await Promise.all([
    getSettings(),
    getSessionActionCount(),
    listSchedules(),
    listRuntimeEvents(100),
  ])
  return {
    extensionId: chrome.runtime.id,
    version: chrome.runtime.getManifest().version,
    activeTab: activeTab
      ? {
          id: activeTab.id,
          title: activeTab.title,
          url: activeTab.url,
          supported: isSupportedFacebookUrl(activeTab.url),
        }
      : undefined,
    queuedJobs: await countJobs(),
    reviewCandidates: candidates.length,
    enabledSchedules: schedules.filter((schedule) => schedule.enabled).length,
    recentErrors: events.filter((event) => event.level === 'ERROR').length,
    sessionActions,
    maxSessionActions: settings.maxActionsPerSession,
    safety: await getSafetyState(),
  }
}

async function scanActiveTab(limit?: number): Promise<ExtensionResponse<FeedPost[]>> {
  const activeTab = await getFacebookTab()
  if (!activeTab?.id) return { ok: false, error: 'Không tìm thấy tab đang hoạt động.' }
  if (!isSupportedFacebookUrl(activeTab.url)) {
    return { ok: false, error: 'Hãy mở facebook.com trên tab hiện tại trước khi quét.' }
  }
  return sendToContent<FeedPost[]>(activeTab.id, { type: 'SCAN_FEED', limit })
}

async function createReviewCandidates(limit = 10): Promise<ReviewCandidate[]> {
  await ensureAutomationAllowed()
  const scan = await scanActiveTab(limit)
  if (!scan.ok) throw new Error(scan.error)

  const created: ReviewCandidate[] = []
  for (const post of scan.data) {
    const id = `review_${post.id}`
    const existing = await getCandidate(id)
    if (existing && ['PREPARED', 'REJECTED'].includes(existing.state)) {
      created.push(existing)
      continue
    }

    const now = Date.now()
    const candidate: ReviewCandidate = {
      id,
      post,
      draft: await (await getAiProvider()).generateComment(post),
      state: existing?.state === 'APPROVED' ? 'APPROVED' : 'READY_FOR_REVIEW',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      error: undefined,
    }
    await upsertCandidate(candidate)
    created.push(candidate)
  }
  return created
}

async function regenerateCandidate(id: string): Promise<ReviewCandidate> {
  await ensureAutomationAllowed()
  const candidate = await getCandidate(id)
  if (!candidate) throw new Error('Không tìm thấy review candidate.')
  if (candidate.state !== 'READY_FOR_REVIEW' && candidate.state !== 'FAILED') {
    throw new Error(`Chỉ regenerate candidate đang chờ duyệt hoặc bị lỗi, hiện tại: ${candidate.state}.`)
  }
  const draft = await (await getAiProvider()).generateComment(candidate.post)
  const updated = await patchCandidate(id, { state: 'READY_FOR_REVIEW', draft, error: undefined })
  if (!updated) throw new Error('Không thể lưu nháp mới.')
  return updated
}

async function updateCandidateDraft(id: string, text: string): Promise<ReviewCandidate> {
  const candidate = await getCandidate(id)
  if (!candidate) throw new Error('Không tìm thấy review candidate.')
  if (candidate.state !== 'READY_FOR_REVIEW') throw new Error('Chỉ chỉnh sửa nháp khi candidate đang chờ duyệt.')
  const normalized = text.trim()
  if (normalized.length < 2 || normalized.length > 1200) throw new Error('Nội dung nháp phải từ 2 đến 1200 ký tự.')
  const updated = await patchCandidate(id, {
    draft: { ...candidate.draft, text: normalized, edited: true, generatedAt: Date.now() },
    error: undefined,
  })
  if (!updated) throw new Error('Không thể lưu nội dung chỉnh sửa.')
  return updated
}

async function transitionCandidate(id: string, nextState: CandidateState): Promise<ReviewCandidate> {
  const candidate = await getCandidate(id)
  if (!candidate) throw new Error('Không tìm thấy review candidate.')
  assertTransition(candidate.state, nextState)
  const updated = await patchCandidate(id, { state: nextState, error: undefined })
  if (!updated) throw new Error('Không thể cập nhật review candidate.')
  return updated
}

async function prepareApprovedCandidate(candidateId: string): Promise<ReviewCandidate> {
  if (activePreparationCandidateId) {
    throw new AutomationError('LOCKED', `Đang chuẩn bị candidate ${activePreparationCandidateId}. Hãy chờ tác vụ đó hoàn tất.`)
  }

  const lockOwner = `review:${candidateId}`
  const locked = await acquireLock('facebook:active-tab', lockOwner, 2 * 60_000)
  if (!locked) {
    throw new AutomationError('LOCKED', 'Browser runtime đang bận với tác vụ khác. Hãy thử lại sau.')
  }

  activePreparationCandidateId = candidateId

  try {
    await ensureAutomationAllowed()
    const settings = await getSettings()
    const currentActionCount = await getSessionActionCount()
    if (currentActionCount >= settings.maxActionsPerSession) {
      throw new AutomationError('INVALID_STATE', `Đã đạt giới hạn ${settings.maxActionsPerSession} thao tác trong phiên này.`)
    }

    const approved = await transitionCandidate(candidateId, 'PREPARING')
    const activeTab = await getFacebookTab()
    if (!activeTab?.id) throw new AutomationError('TAB_NOT_FOUND', 'Không tìm thấy tab đang hoạt động.', true)
    if (!isSupportedFacebookUrl(activeTab.url)) {
      throw new AutomationError('WRONG_PAGE', 'Tab hiện tại không phải Facebook.', true)
    }

    const result = await sendToContent<PrepareCommentResult>(activeTab.id, {
      type: 'PREPARE_COMMENT',
      postId: approved.post.id,
      comment: approved.draft.text,
    })
    if (!result.ok) throw new Error(result.error)
    if (!result.data.prepared) throw new Error('Không xác minh được nội dung trong ô bình luận.')

    const prepared = await patchCandidate(candidateId, { state: 'PREPARED', error: undefined })
    if (!prepared) throw new Error('Không thể lưu trạng thái PREPARED.')
    await incrementSessionActionCount()
    await logRuntimeEvent('INFO', 'REVIEW', 'Đã điền nội dung đã duyệt vào composer. Người dùng vẫn cần tự bấm Gửi.')
    return prepared
  } catch (error) {
    const classified = classifyAutomationError(error)
    await patchCandidate(candidateId, { state: 'FAILED', error: `${classified.code}: ${classified.message}` })
    await logRuntimeEvent('ERROR', 'REVIEW', 'Không thể chuẩn bị nội dung trong composer.', classified.message)
    throw classified
  } finally {
    activePreparationCandidateId = null
    await releaseLock('facebook:active-tab', lockOwner)
  }
}

async function materializeSchedules(now = Date.now()): Promise<void> {
  const schedules = await listSchedules()
  for (const schedule of schedules) {
    if (!scheduleCanRun(schedule, new Date(now))) continue
    const bucket = Math.floor(now / 60_000)
    await enqueueJob({
      type: 'CREATE_REVIEW_CANDIDATES',
      dedupeKey: `schedule:${schedule.id}:${bucket}`,
      resourceKey: 'facebook:active-tab',
      payload: { limit: schedule.maxPosts, scheduleId: schedule.id, scheduleName: schedule.name },
      scheduledAt: now,
      maxAttempts: 4,
    })
    await markScheduleRun(schedule.id, now)
    await logRuntimeEvent('INFO', 'SCHEDULER', `Đã đưa lịch "${schedule.name}" vào hàng đợi.`)
  }
}

async function processQueueTick(): Promise<void> {
  const safety = await getSafetyState()
  if (safety.emergencyStop) return

  await materializeSchedules()
  const jobs = await claimDueJobs(WORKER_ID, 3, 2 * 60_000)

  for (const job of jobs) {
    const locked = await acquireLock(job.resourceKey, job.id, 2 * 60_000)
    if (!locked) {
      await updateJob(job.id, {
        state: 'PENDING',
        scheduledAt: Date.now() + 30_000,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        lastError: 'Resource is currently locked by another job.',
      })
      await logRuntimeEvent('WARN', 'QUEUE', `Job ${job.id} đang chờ lock ${job.resourceKey}.`)
      continue
    }

    try {
      if (job.type === 'SCAN_FEED') {
        const result = await scanActiveTab(Number(job.payload.limit ?? 20))
        if (!result.ok) throw new Error(result.error)
        await updateJob(job.id, {
          state: 'SUCCESS',
          payload: { ...job.payload, resultCount: result.data.length },
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          lastError: undefined,
        })
        await logRuntimeEvent('INFO', 'QUEUE', `Quét feed thành công: ${result.data.length} bài.`)
      } else if (job.type === 'CREATE_REVIEW_CANDIDATES') {
        const candidates = await createReviewCandidates(Number(job.payload.limit ?? 10))
        await updateJob(job.id, {
          state: 'SUCCESS',
          payload: { ...job.payload, candidateCount: candidates.length },
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          lastError: undefined,
        })
        await logRuntimeEvent('INFO', 'REVIEW', `Đã tạo ${candidates.length} ứng viên chờ duyệt.`)
      } else {
        await updateJob(job.id, {
          state: 'READY_FOR_REVIEW',
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown queue error'
      const shouldRetry = job.attempts < job.maxAttempts
      await updateJob(job.id, {
        state: shouldRetry ? 'PENDING' : 'FAILED',
        scheduledAt: Date.now() + computeBackoffMs(job.attempts),
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        lastError: message,
      })
      await logRuntimeEvent(
        shouldRetry ? 'WARN' : 'ERROR',
        'QUEUE',
        shouldRetry ? `Job lỗi, sẽ thử lại lần ${job.attempts + 1}.` : 'Job thất bại sau khi hết số lần thử.',
        message,
      )
    } finally {
      await releaseLock(job.resourceKey, job.id)
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultSettings()
  void chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 })
  void logRuntimeEvent('INFO', 'SYSTEM', 'AutoTool runtime đã được cài đặt/cập nhật.')
})

chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === QUEUE_ALARM) void processQueueTick()
})

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('index.html') })
})

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'PING') {
        sendResponse({ ok: true, data: { pong: true, version: chrome.runtime.getManifest().version } })
        return
      }
      if (message.type === 'GET_RUNTIME_STATUS') {
        const response: ExtensionResponse<RuntimeStatus> = { ok: true, data: await getRuntimeStatus() }
        sendResponse(response)
        return
      }
      if (message.type === 'SCAN_ACTIVE_TAB') {
        sendResponse(await scanActiveTab(message.limit))
        return
      }
      if (message.type === 'CREATE_REVIEW_CANDIDATES') {
        const response: ExtensionResponse<ReviewCandidate[]> = { ok: true, data: await createReviewCandidates(message.limit) }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_LIST') {
        const response: ExtensionResponse<ReviewCandidate[]> = { ok: true, data: await listCandidates(message.states) }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_APPROVE') {
        const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await transitionCandidate(message.candidateId, 'APPROVED') }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_REJECT') {
        const candidate = await getCandidate(message.candidateId)
        if (!candidate) throw new Error('Không tìm thấy review candidate.')
        if (candidate.state === 'READY_FOR_REVIEW' || candidate.state === 'APPROVED') {
          const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await transitionCandidate(message.candidateId, 'REJECTED') }
          sendResponse(response)
          return
        }
        throw new Error(`Không thể bỏ qua candidate ở trạng thái ${candidate.state}.`)
      }
      if (message.type === 'REVIEW_PREPARE') {
        const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await prepareApprovedCandidate(message.candidateId) }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_RETRY') {
        const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await transitionCandidate(message.candidateId, 'READY_FOR_REVIEW') }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_REGENERATE') {
        const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await regenerateCandidate(message.candidateId) }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_UPDATE_DRAFT') {
        const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await updateCandidateDraft(message.candidateId, message.text) }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_CLEAR') {
        await clearCandidates()
        sendResponse({ ok: true, data: { cleared: true } })
        return
      }
      if (message.type === 'GET_SAFETY_STATE') {
        sendResponse({ ok: true, data: await getSafetyState() })
        return
      }
      if (message.type === 'SET_EMERGENCY_STOP') {
        sendResponse({ ok: true, data: await setEmergencyStop(message.enabled) })
        return
      }
      if (message.type === 'AI_SETTINGS_GET') {
        const response: ExtensionResponse<AiSettingsView> = { ok: true, data: await getAiSettingsView() }
        sendResponse(response)
        return
      }
      if (message.type === 'AI_SETTINGS_SET') {
        const settings: AiGatewaySettings = {
          ...message.settings,
          gatewayUrl: normalizeGatewayUrl(message.settings.gatewayUrl),
          timeoutMs: Math.max(3_000, Math.min(60_000, Number(message.settings.timeoutMs) || 20_000)),
        }
        await saveAiGatewaySettings(settings)
        if (message.token !== undefined) await setAiGatewayToken(message.token)
        const response: ExtensionResponse<AiSettingsView> = { ok: true, data: await getAiSettingsView() }
        sendResponse(response)
        return
      }
      if (message.type === 'AI_GATEWAY_TEST') {
        const response: ExtensionResponse<AiHealthResponse> = { ok: true, data: await testGatewayConnection() }
        sendResponse(response)
        return
      }
      if (message.type === 'QUEUE_LIST') {
        const response: ExtensionResponse<QueueJob[]> = { ok: true, data: await listJobs() }
        sendResponse(response)
        return
      }
      if (message.type === 'QUEUE_RUN_NOW') {
        await processQueueTick()
        sendResponse({ ok: true, data: { processed: true } })
        return
      }
      if (message.type === 'SCHEDULE_LIST') {
        const response: ExtensionResponse<ReviewSchedule[]> = { ok: true, data: await listSchedules() }
        sendResponse(response)
        return
      }
      if (message.type === 'SCHEDULE_UPSERT') {
        const schedule = await upsertSchedule(message.schedule)
        await logRuntimeEvent('INFO', 'SCHEDULER', `Đã lưu lịch "${schedule.name}".`)
        const response: ExtensionResponse<ReviewSchedule> = { ok: true, data: schedule }
        sendResponse(response)
        return
      }
      if (message.type === 'SCHEDULE_DELETE') {
        await deleteSchedule(message.scheduleId)
        await logRuntimeEvent('INFO', 'SCHEDULER', 'Đã xóa lịch chạy.')
        sendResponse({ ok: true, data: { deleted: true } })
        return
      }
      if (message.type === 'SCHEDULE_RUN_NOW') {
        const schedule = (await listSchedules()).find((item) => item.id === message.scheduleId)
        if (!schedule) throw new Error('Không tìm thấy lịch chạy.')
        await enqueueJob({
          type: 'CREATE_REVIEW_CANDIDATES',
          dedupeKey: `manual-schedule:${schedule.id}:${crypto.randomUUID()}`,
          resourceKey: 'facebook:active-tab',
          payload: { limit: schedule.maxPosts, scheduleId: schedule.id, scheduleName: schedule.name },
          scheduledAt: Date.now(),
          maxAttempts: 4,
        })
        await logRuntimeEvent('INFO', 'SCHEDULER', `Đã yêu cầu chạy ngay lịch "${schedule.name}".`)
        await processQueueTick()
        sendResponse({ ok: true, data: { queued: true } })
        return
      }
      if (message.type === 'EVENT_LIST') {
        const response: ExtensionResponse<RuntimeEvent[]> = { ok: true, data: await listRuntimeEvents(message.limit ?? 100) }
        sendResponse(response)
        return
      }
      if (message.type === 'EVENT_CLEAR') {
        await clearRuntimeEvents()
        sendResponse({ ok: true, data: { cleared: true } })
        return
      }
      if (message.type === 'QUEUE_ENQUEUE') {
        const response: ExtensionResponse<QueueJob> = { ok: true, data: await enqueueJob(message.job) }
        sendResponse(response)
        return
      }
      if (message.type === 'QUEUE_CLEAR') {
        await clearQueue()
        sendResponse({ ok: true, data: { cleared: true } })
      }
    } catch (error) {
      const response: ExtensionResponse = {
        ok: false,
        error: error instanceof Error ? error.message : 'Background service worker error',
      }
      sendResponse(response)
    }
  })()
  return true
})
