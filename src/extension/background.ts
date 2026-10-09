import { localMockAiProvider, type AiDraftProvider } from '../automation/aiProvider'
import { createGatewayAiProvider, isSupportedGatewayUrl, isTrustedFirebaseGatewayUrl, normalizeGatewayUrl, trustedFirebaseGatewayOrigin } from '../ai/gatewayProvider'
import type { AiGatewaySettings, AiHealthResponse } from '../ai/contracts'
import type { CandidateState, ReviewCandidate } from '../automation/model'
import { getCandidate, listCandidates, patchCandidate, upsertCandidate, clearCandidates } from '../automation/reviewStore'
import { assertTransition } from '../automation/stateMachine'
import { approvalSnapshot, shouldGenerateForScannedPost } from '../automation/reviewPolicy'
import { AutomationError, classifyAutomationError } from '../automation/errors'
import { isSupportedFacebookUrl } from '../core/helpers'
import { claimDueJobs, clearQueue, countJobs, enqueueJob, listJobs, renewJobLease, skipPendingJobs, updateJob } from './queue'
import { acquireLock, releaseLock, renewLock } from '../runtime/locks'
import { clearRuntimeEvents, listRuntimeEvents, listRuntimeEventsAfter, logRuntimeEvent } from '../runtime/events'
import { applyRemoteSchedule, deleteSchedule, listSchedules, markScheduleRun, scheduleCanRun, setScheduleDefinitionRevision, touchSchedule, upsertSchedule } from '../runtime/schedules'
import { computeBackoffMs } from '../runtime/retry'
import type { ReviewSchedule, RuntimeEvent } from '../runtime/types'
import type { AdapterDiagnostic, PlatformContext } from '../platform/types'
import { addScheduleTombstone, clearScheduleTombstones, ensureDefaultSettings, getScheduleTombstones, getSafetyState, setEmergencyStop, getSettings, getSessionActionCount, incrementSessionActionCount, getAiGatewaySettings, saveAiGatewaySettings, getAiGatewayToken, setAiGatewayToken, getPilotSettings, savePilotSettings } from './storage'
import { getRuntimeDbInfo } from './runtimeDb'
import { effectiveActionLimit, effectivePostLimit, releaseChannelFromVersionName } from './pilot'
import { cleanupRuntimeData } from '../runtime/retention'
import { getFirebaseAuth } from '../backend/client'
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
const RETENTION_KEY = 'autotool.retention.lastRun'
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000
const QUEUE_LEASE_MS = 2 * 60_000
const QUEUE_HEARTBEAT_MS = 30_000
const WORKER_ID = `service-worker:${chrome.runtime.id}`
let activePreparationCandidateId: string | null = null

async function getFacebookTab(expectedAccountContextKey?: string): Promise<chrome.tabs.Tab | undefined> {
  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true })
  const allTabs = await chrome.tabs.query({})
  const ordered = [
    ...currentWindowTabs.filter((tab) => tab.active && isSupportedFacebookUrl(tab.url)),
    ...currentWindowTabs.filter((tab) => !tab.active && isSupportedFacebookUrl(tab.url)),
    ...allTabs.filter((tab) => !currentWindowTabs.some((current) => current.id === tab.id) && isSupportedFacebookUrl(tab.url)),
  ]

  if (!expectedAccountContextKey) return ordered[0]

  for (const tab of ordered) {
    if (!tab.id) continue
    const context = await sendToContent<PlatformContext>(tab.id, { type: 'GET_PLATFORM_CONTEXT' })
    if (context.ok && context.data.account?.key === expectedAccountContextKey) return tab
  }

  return undefined
}

async function getFacebookRuntimeContext(expectedAccountContextKey?: string): Promise<{
  tab: chrome.tabs.Tab
  context: PlatformContext
  diagnostic: AdapterDiagnostic
} | undefined> {
  const tab = await getFacebookTab(expectedAccountContextKey)
  if (!tab?.id) return undefined

  const [context, diagnostic] = await Promise.all([
    sendToContent<PlatformContext>(tab.id, { type: 'GET_PLATFORM_CONTEXT' }),
    sendToContent<AdapterDiagnostic>(tab.id, { type: 'GET_ADAPTER_DIAGNOSTIC' }),
  ])

  if (!context.ok || !diagnostic.ok) return undefined
  if (expectedAccountContextKey && context.data.account?.key !== expectedAccountContextKey) return undefined

  return { tab, context: context.data, diagnostic: diagnostic.data }
}

async function sendToContent<T>(tabId: number, request: ContentRequest): Promise<ExtensionResponse<T>> {
  try {
    return await chrome.tabs.sendMessage(tabId, request) as ExtensionResponse<T>
  } catch {
    return { ok: false, error: 'Content script chưa sẵn sàng trên tab này. Hãy tải lại trang rồi thử lại.' }
  }
}

async function getGatewayBearer(settings: AiGatewaySettings): Promise<string | undefined> {
  if (settings.authMode === 'token') return getAiGatewayToken()
  const trustedOrigin = trustedFirebaseGatewayOrigin()
  if (!trustedOrigin || !isTrustedFirebaseGatewayUrl(settings.gatewayUrl, trustedOrigin)) {
    throw new Error('Firebase ID token chỉ được gửi tới AI Gateway origin đã pin trong build.')
  }
  const auth = await getFirebaseAuth()
  if (!auth) throw new Error('Firebase chưa được cấu hình cho AI Gateway auth.')
  await auth.authStateReady()
  if (!auth.currentUser) throw new Error('Hãy đăng nhập Firebase trước khi dùng AI Gateway.')
  return auth.currentUser.getIdToken()
}

async function getAiProvider(): Promise<AiDraftProvider> {
  const settings = await getAiGatewaySettings()
  if (settings.mode === 'local') return localMockAiProvider
  return createGatewayAiProvider(settings, await getGatewayBearer(settings))
}

async function getAiSettingsView(): Promise<AiSettingsView> {
  const [settings, token] = await Promise.all([getAiGatewaySettings(), getAiGatewayToken()])
  return { settings, hasToken: Boolean(token) }
}

async function testGatewayConnection(): Promise<AiHealthResponse> {
  const settings = await getAiGatewaySettings()
  if (settings.mode !== 'gateway') throw new Error('AI mode hiện tại đang là local.')
  const token = await getGatewayBearer(settings)
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
  const runtimeContext = await getFacebookRuntimeContext()
  const activeTab = runtimeContext?.tab
  const candidates = await listCandidates(['READY_FOR_REVIEW', 'APPROVED', 'PREPARING'])
  const [settings, pilot, sessionActions, schedules, events, dbInfo] = await Promise.all([
    getSettings(),
    getPilotSettings(),
    getSessionActionCount(),
    listSchedules(),
    listRuntimeEvents(100),
    getRuntimeDbInfo(),
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
    platformContext: runtimeContext?.context,
    adapterDiagnostic: runtimeContext?.diagnostic,
    queuedJobs: await countJobs(),
    reviewCandidates: candidates.length,
    enabledSchedules: schedules.filter((schedule) => schedule.enabled).length,
    recentErrors: events.filter((event) => event.level === 'ERROR').length,
    runtimeDbVersion: dbInfo.version,
    runtimeDbSchemaVersion: dbInfo.schemaVersion,
    releaseChannel: releaseChannelFromVersionName(chrome.runtime.getManifest().version_name),
    pilot,
    sessionActions,
    maxSessionActions: effectiveActionLimit(settings.maxActionsPerSession, pilot),
    safety: await getSafetyState(),
  }
}

async function scanActiveTab(
  limit?: number,
  expectedAccountContextKey?: string,
): Promise<ExtensionResponse<FeedPost[]>> {
  const runtimeContext = await getFacebookRuntimeContext(expectedAccountContextKey)
  if (!runtimeContext?.tab.id) {
    return {
      ok: false,
      error: expectedAccountContextKey
        ? 'Không tìm thấy tab Facebook đúng account context đã bind.'
        : 'Không tìm thấy tab Facebook khả dụng.',
    }
  }
  if (expectedAccountContextKey && runtimeContext.context.account?.key !== expectedAccountContextKey) {
    return { ok: false, error: 'Account context hiện tại không khớp với job/schedule.' }
  }
  return sendToContent<FeedPost[]>(runtimeContext.tab.id, { type: 'SCAN_FEED', limit })
}

async function createReviewCandidates(
  limit = 10,
  expectedAccountContextKey?: string,
): Promise<ReviewCandidate[]> {
  await ensureAutomationAllowed()
  const pilot = await getPilotSettings()
  const scan = await scanActiveTab(effectivePostLimit(limit, pilot), expectedAccountContextKey)
  if (!scan.ok) throw new Error(scan.error)
  const created: ReviewCandidate[] = []
  const provider = await getAiProvider()
  for (const post of scan.data) {
    const id = `review_${post.id}`
    const existing = await getCandidate(id)
    if (!shouldGenerateForScannedPost(existing)) {
      created.push(existing!)
      continue
    }
    const now = Date.now()
    const candidate: ReviewCandidate = {
      id, post, draft: await provider.generateComment(post), state: 'READY_FOR_REVIEW',
      createdAt: now, updatedAt: now, error: undefined,
    }
    await upsertCandidate(candidate)
    created.push(candidate)
  }
  return created
}

async function approveCandidate(id: string): Promise<ReviewCandidate> {
  const candidate = await getCandidate(id)
  if (!candidate) throw new Error('Không tìm thấy review candidate.')
  assertTransition(candidate.state, 'APPROVED')
  const updated = await patchCandidate(id, { state: 'APPROVED', ...approvalSnapshot(candidate.draft), error: undefined })
  if (!updated) throw new Error('Không thể lưu snapshot đã duyệt.')
  return updated
}

async function regenerateCandidate(id: string): Promise<ReviewCandidate> {
  await ensureAutomationAllowed()
  const candidate = await getCandidate(id)
  if (!candidate) throw new Error('Không tìm thấy review candidate.')
  if (candidate.state !== 'READY_FOR_REVIEW' && candidate.state !== 'FAILED') {
    throw new Error(`Chỉ regenerate candidate đang chờ duyệt hoặc bị lỗi, hiện tại: ${candidate.state}.`)
  }
  const draft = await (await getAiProvider()).generateComment(candidate.post)
  const updated = await patchCandidate(id, { state: 'READY_FOR_REVIEW', draft, approvedDraft: undefined, approvedAt: undefined, error: undefined })
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

  const candidate = await getCandidate(candidateId)
  if (!candidate) throw new Error('Không tìm thấy review candidate.')
  const approvedText = candidate.approvedDraft?.text?.trim()
  if (!approvedText || !candidate.approvedAt) {
    throw new AutomationError('INVALID_STATE', 'Candidate chưa có snapshot nội dung đã duyệt. Hãy duyệt lại trước khi chuẩn bị comment.')
  }

  const expectedAccountContextKey = candidate.post.accountContextKey
  if (!expectedAccountContextKey) {
    throw new AutomationError(
      'INVALID_STATE',
      'Candidate cũ chưa có account context. Hãy quét lại bài trước khi chuẩn bị comment.',
    )
  }

  const resourceKey = `facebook:${expectedAccountContextKey}`
  const lockOwner = `review:${candidateId}`
  const locked = await acquireLock(resourceKey, lockOwner, 2 * 60_000)
  if (!locked) {
    throw new AutomationError('LOCKED', 'Browser runtime của account này đang bận. Hãy thử lại sau.')
  }

  activePreparationCandidateId = candidateId

  try {
    await ensureAutomationAllowed()
    const [settings, pilot] = await Promise.all([getSettings(), getPilotSettings()])
    const currentActionCount = await getSessionActionCount()
    const actionLimit = effectiveActionLimit(settings.maxActionsPerSession, pilot)
    if (currentActionCount >= actionLimit) {
      throw new AutomationError('INVALID_STATE', `Đã đạt giới hạn ${actionLimit} thao tác trong phiên này.`)
    }

    const runtimeContext = await getFacebookRuntimeContext(expectedAccountContextKey)
    if (!runtimeContext?.tab.id || !runtimeContext.context.account?.verified) {
      throw new AutomationError(
        'WRONG_PAGE',
        'Không xác minh được tab Facebook đúng account context của candidate.',
        true,
      )
    }

    const approved = await transitionCandidate(candidateId, 'PREPARING')
    const result = await sendToContent<PrepareCommentResult>(runtimeContext.tab.id, {
      type: 'PREPARE_COMMENT',
      postId: approved.post.id,
      comment: approved.approvedDraft?.text ?? approvedText,
    })
    if (!result.ok) throw new Error(result.error)
    if (!result.data.prepared) throw new Error('Không xác minh được nội dung trong ô bình luận.')

    const prepared = await patchCandidate(candidateId, { state: 'PREPARED', error: undefined })
    if (!prepared) throw new Error('Không thể lưu trạng thái PREPARED.')
    await incrementSessionActionCount()
    await logRuntimeEvent(
      'INFO',
      'REVIEW',
      `Đã điền nội dung vào composer của account "${runtimeContext.context.account.label}". Người dùng vẫn cần tự bấm Gửi.`,
    )
    return prepared
  } catch (error) {
    const classified = classifyAutomationError(error)
    await patchCandidate(candidateId, { state: 'FAILED', error: `${classified.code}: ${classified.message}` })
    await logRuntimeEvent('ERROR', 'REVIEW', 'Không thể chuẩn bị nội dung trong composer.', classified.message)
    throw classified
  } finally {
    activePreparationCandidateId = null
    await releaseLock(resourceKey, lockOwner)
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
      resourceKey: `facebook:${schedule.accountBinding!.key}`,
      payload: {
        limit: schedule.maxPosts,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        expectedAccountContextKey: schedule.accountBinding!.key,
      },
      scheduledAt: now,
      maxAttempts: 4,
    })
    await markScheduleRun(schedule.id, now)
    await logRuntimeEvent('INFO', 'SCHEDULER', `Đã đưa lịch "${schedule.name}" vào hàng đợi.`)
  }
}

function startQueueLeaseHeartbeat(job: QueueJob): () => void {
  const timer = globalThis.setInterval(() => {
    void Promise.all([
      renewJobLease(job.id, WORKER_ID, QUEUE_LEASE_MS),
      renewLock(job.resourceKey, job.id, QUEUE_LEASE_MS),
    ]).then(([jobLeaseOk, lockLeaseOk]) => {
      if (!jobLeaseOk || !lockLeaseOk) void logRuntimeEvent('WARN', 'QUEUE', `Không thể gia hạn lease cho job ${job.id}.`)
    })
  }, QUEUE_HEARTBEAT_MS)
  return () => globalThis.clearInterval(timer)
}

async function runRetentionIfDue(now = Date.now()): Promise<void> {
  const stored = await chrome.storage.local.get(RETENTION_KEY)
  const lastRun = Number(stored[RETENTION_KEY] ?? 0)
  if (now - lastRun < RETENTION_INTERVAL_MS) return
  const summary = await cleanupRuntimeData(now)
  await chrome.storage.local.set({ [RETENTION_KEY]: now })
  if (summary.jobsDeleted || summary.candidatesDeleted || summary.eventsDeleted || summary.locksDeleted) {
    await logRuntimeEvent('INFO', 'SYSTEM', 'Đã dọn dữ liệu runtime cũ.', JSON.stringify(summary))
  }
}

async function processQueueTick(): Promise<void> {
  await runRetentionIfDue()
  const safety = await getSafetyState()
  if (safety.emergencyStop) return

  await materializeSchedules()
  const jobs = await claimDueJobs(WORKER_ID, 1, QUEUE_LEASE_MS)

  for (const job of jobs) {
    const locked = await acquireLock(job.resourceKey, job.id, QUEUE_LEASE_MS)
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

    const stopHeartbeat = startQueueLeaseHeartbeat(job)

    try {
      if (job.type === 'SCAN_FEED') {
        const result = await scanActiveTab(
          Number(job.payload.limit ?? 20),
          typeof job.payload.expectedAccountContextKey === 'string' ? job.payload.expectedAccountContextKey : undefined,
        )
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
        const candidates = await createReviewCandidates(
          Number(job.payload.limit ?? 10),
          typeof job.payload.expectedAccountContextKey === 'string' ? job.payload.expectedAccountContextKey : undefined,
        )
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
      stopHeartbeat()
      await releaseLock(job.resourceKey, job.id)
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultSettings()
  void runRetentionIfDue()
  void chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 })
  void logRuntimeEvent('INFO', 'SYSTEM', 'AutoTool runtime đã được cài đặt/cập nhật.')
})

chrome.runtime.onStartup.addListener(() => {
  void runRetentionIfDue()
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
      if (message.type === 'GET_PLATFORM_CONTEXT') {
        const runtimeContext = await getFacebookRuntimeContext()
        if (!runtimeContext) throw new Error('Không lấy được Facebook platform context.')
        const response: ExtensionResponse<PlatformContext> = { ok: true, data: runtimeContext.context }
        sendResponse(response)
        return
      }
      if (message.type === 'GET_ADAPTER_DIAGNOSTIC') {
        const runtimeContext = await getFacebookRuntimeContext()
        if (!runtimeContext) throw new Error('Không lấy được Facebook adapter diagnostic.')
        const response: ExtensionResponse<AdapterDiagnostic> = { ok: true, data: runtimeContext.diagnostic }
        sendResponse(response)
        return
      }
      if (message.type === 'SCAN_ACTIVE_TAB') {
        sendResponse(await scanActiveTab(message.limit, message.expectedAccountContextKey))
        return
      }
      if (message.type === 'CREATE_REVIEW_CANDIDATES') {
        const response: ExtensionResponse<ReviewCandidate[]> = {
          ok: true,
          data: await createReviewCandidates(message.limit, message.expectedAccountContextKey),
        }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_LIST') {
        const response: ExtensionResponse<ReviewCandidate[]> = { ok: true, data: await listCandidates(message.states) }
        sendResponse(response)
        return
      }
      if (message.type === 'REVIEW_APPROVE') {
        const response: ExtensionResponse<ReviewCandidate> = { ok: true, data: await approveCandidate(message.candidateId) }
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
        const candidate = await getCandidate(message.candidateId)
        if (!candidate) throw new Error('Không tìm thấy review candidate.')
        assertTransition(candidate.state, 'READY_FOR_REVIEW')
        const retried = await patchCandidate(message.candidateId, { state: 'READY_FOR_REVIEW', approvedDraft: undefined, approvedAt: undefined, error: undefined })
        if (!retried) throw new Error('Không thể đưa candidate về hàng chờ duyệt.')
        sendResponse({ ok: true, data: retried })
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
        const state = await setEmergencyStop(message.enabled)
        if (message.enabled) {
          const skipped = await skipPendingJobs('Cancelled by Emergency Stop')
          await logRuntimeEvent('WARN', 'SYSTEM', `Emergency Stop bật; đã hủy ${skipped} job đang chờ.`)
        }
        sendResponse({ ok: true, data: state })
        return
      }
      if (message.type === 'AI_SETTINGS_GET') {
        const response: ExtensionResponse<AiSettingsView> = { ok: true, data: await getAiSettingsView() }
        sendResponse(response)
        return
      }
      if (message.type === 'AI_SETTINGS_SET') {
        const normalizedGatewayUrl = normalizeGatewayUrl(message.settings.gatewayUrl)
        if (message.settings.mode === 'gateway' && !isSupportedGatewayUrl(normalizedGatewayUrl)) {
          throw new Error('Gateway production phải dùng HTTPS *.workers.dev; localhost chỉ dành cho dev.')
        }
        if (message.settings.mode === 'gateway' && message.settings.authMode === 'firebase') {
          const trustedOrigin = trustedFirebaseGatewayOrigin()
          if (!trustedOrigin || !isTrustedFirebaseGatewayUrl(normalizedGatewayUrl, trustedOrigin)) {
            throw new Error('Firebase auth yêu cầu Gateway URL trùng chính xác VITE_AI_GATEWAY_ORIGIN đã pin khi build.')
          }
        }
        const settings: AiGatewaySettings = {
          ...message.settings,
          gatewayUrl: normalizedGatewayUrl,
          timeoutMs: Math.max(3_000, Math.min(60_000, Number(message.settings.timeoutMs) || 20_000)),
        }
        await saveAiGatewaySettings(settings)
        if (settings.authMode === 'firebase') await setAiGatewayToken(undefined)
        else if (message.token !== undefined) await setAiGatewayToken(message.token)
        const response: ExtensionResponse<AiSettingsView> = { ok: true, data: await getAiSettingsView() }
        sendResponse(response)
        return
      }
      if (message.type === 'AI_GATEWAY_TEST') {
        const response: ExtensionResponse<AiHealthResponse> = { ok: true, data: await testGatewayConnection() }
        sendResponse(response)
        return
      }
      if (message.type === 'PILOT_SETTINGS_GET') {
        sendResponse({ ok: true, data: await getPilotSettings() })
        return
      }
      if (message.type === 'PILOT_SETTINGS_SET') {
        const settings = await savePilotSettings(message.settings)
        await logRuntimeEvent('INFO', 'SYSTEM', `Pilot mode ${settings.enabled ? 'đã bật' : 'đã tắt'}. Telemetry ${settings.telemetryOptIn ? 'opt-in' : 'tắt'}.`)
        sendResponse({ ok: true, data: settings })
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
        const runtimeContext = await getFacebookRuntimeContext()
        const account = runtimeContext?.context.account
        if (!account?.verified) {
          throw new Error('Chưa xác minh được account context. Hãy mở Facebook đúng tài khoản và thử lại.')
        }
        const schedule = await upsertSchedule({
          ...message.schedule,
          accountBinding: {
            key: account.key,
            label: account.label,
            profileUrl: account.profileUrl,
          },
        })
        await logRuntimeEvent(
          'INFO',
          'SCHEDULER',
          `Đã bind lịch "${schedule.name}" với account "${account.label}".`,
        )
        const response: ExtensionResponse<ReviewSchedule> = { ok: true, data: schedule }
        sendResponse(response)
        return
      }
      if (message.type === 'SCHEDULE_DELETE') {
        const current = (await listSchedules()).find((item) => item.id === message.scheduleId)
        await addScheduleTombstone({
          id: message.scheduleId,
          baseRevision: current?.definitionRevision ?? 0,
          deletedAt: Date.now(),
        })
        await deleteSchedule(message.scheduleId)
        await logRuntimeEvent('INFO', 'SCHEDULER', 'Đã xóa lịch chạy.')
        sendResponse({ ok: true, data: { deleted: true } })
        return
      }
      if (message.type === 'SCHEDULE_TOMBSTONES_LIST') {
        sendResponse({ ok: true, data: await getScheduleTombstones() })
        return
      }
      if (message.type === 'SCHEDULE_TOMBSTONES_CLEAR') {
        await clearScheduleTombstones(message.scheduleIds)
        sendResponse({ ok: true, data: { cleared: true } })
        return
      }
      if (message.type === 'SCHEDULE_SET_REVISION') {
        const schedule = await setScheduleDefinitionRevision(message.scheduleId, message.revision, message.definitionUpdatedAt)
        if (!schedule) throw new Error('Không tìm thấy lịch local cần cập nhật revision.')
        sendResponse({ ok: true, data: schedule })
        return
      }
      if (message.type === 'SCHEDULE_RUN_NOW') {
        await ensureAutomationAllowed()
        const schedule = (await listSchedules()).find((item) => item.id === message.scheduleId)
        if (!schedule) throw new Error('Không tìm thấy lịch chạy.')
        if (!schedule.accountBinding) throw new Error('Lịch cũ chưa bind account context. Hãy sửa và lưu lại lịch.')
        const runtimeContext = await getFacebookRuntimeContext(schedule.accountBinding.key)
        if (!runtimeContext?.context.account?.verified) {
          throw new Error('Không tìm thấy tab Facebook đúng account đã bind cho lịch.')
        }
        await enqueueJob({
          type: 'CREATE_REVIEW_CANDIDATES',
          dedupeKey: `manual-schedule:${schedule.id}:${crypto.randomUUID()}`,
          resourceKey: `facebook:${schedule.accountBinding.key}`,
          payload: {
            limit: schedule.maxPosts,
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            expectedAccountContextKey: schedule.accountBinding.key,
          },
          scheduledAt: Date.now(),
          maxAttempts: 4,
        })
        await logRuntimeEvent(
          'INFO',
          'SCHEDULER',
          `Đã yêu cầu chạy lịch "${schedule.name}" cho account "${schedule.accountBinding.label}".`,
        )
        await processQueueTick()
        sendResponse({ ok: true, data: { queued: true } })
        return
      }
      if (message.type === 'SCHEDULE_TOUCH') {
        const schedule = await touchSchedule(message.scheduleId)
        if (!schedule) throw new Error('Không tìm thấy lịch local cần giữ.')
        await logRuntimeEvent('INFO', 'SCHEDULER', `Đã chọn giữ bản local cho lịch "${schedule.name}".`)
        const response: ExtensionResponse<ReviewSchedule> = { ok: true, data: schedule }
        sendResponse(response)
        return
      }
      if (message.type === 'SCHEDULE_APPLY_REMOTE') {
        const schedule = await applyRemoteSchedule(message.schedule, message.revision, message.definitionUpdatedAt)
        await logRuntimeEvent('INFO', 'SCHEDULER', `Đã áp dụng bản cloud cho lịch "${schedule.name}".`)
        const response: ExtensionResponse<ReviewSchedule> = { ok: true, data: schedule }
        sendResponse(response)
        return
      }
      if (message.type === 'EVENT_LIST') {
        const response: ExtensionResponse<RuntimeEvent[]> = { ok: true, data: await listRuntimeEvents(message.limit ?? 100) }
        sendResponse(response)
        return
      }
      if (message.type === 'EVENT_LIST_AFTER') {
        sendResponse({ ok: true, data: await listRuntimeEventsAfter(message.cursor, message.limit ?? 500) })
        return
      }
      if (message.type === 'EVENT_CLEAR') {
        await clearRuntimeEvents()
        sendResponse({ ok: true, data: { cleared: true } })
        return
      }
      if (message.type === 'QUEUE_ENQUEUE') {
        await ensureAutomationAllowed()
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
