import { localMockAiProvider } from '../automation/aiProvider'
import type { CandidateState, ReviewCandidate } from '../automation/model'
import { getCandidate, listCandidates, patchCandidate, upsertCandidate, clearCandidates } from '../automation/reviewStore'
import { assertTransition } from '../automation/stateMachine'
import { AutomationError, classifyAutomationError } from '../automation/errors'
import { isSupportedFacebookUrl } from '../core/helpers'
import { clearQueue, countJobs, enqueueJob, listJobs, updateJob } from './queue'
import { ensureDefaultSettings, getSafetyState, setEmergencyStop, getSettings, getSessionActionCount, incrementSessionActionCount } from './storage'
import type {
  BackgroundRequest,
  ContentRequest,
  ExtensionResponse,
  FeedPost,
  PrepareCommentResult,
  QueueJob,
  RuntimeStatus,
} from './types'

const QUEUE_ALARM = 'autotool.queue.tick'
let activePreparationCandidateId: string | null = null

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function sendToContent<T>(tabId: number, request: ContentRequest): Promise<ExtensionResponse<T>> {
  try {
    return await chrome.tabs.sendMessage(tabId, request) as ExtensionResponse<T>
  } catch {
    return { ok: false, error: 'Content script chưa sẵn sàng trên tab này. Hãy tải lại trang rồi thử lại.' }
  }
}

async function ensureAutomationAllowed(): Promise<void> {
  const safety = await getSafetyState()
  if (safety.emergencyStop) {
    throw new AutomationError('EMERGENCY_STOP', 'Emergency Stop đang bật. Tắt Emergency Stop trước khi tiếp tục.')
  }
}

async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const activeTab = await getActiveTab()
  const candidates = await listCandidates(['READY_FOR_REVIEW', 'APPROVED', 'PREPARING'])
  const [settings, sessionActions] = await Promise.all([getSettings(), getSessionActionCount()])
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
    sessionActions,
    maxSessionActions: settings.maxActionsPerSession,
    safety: await getSafetyState(),
  }
}

async function scanActiveTab(limit?: number): Promise<ExtensionResponse<FeedPost[]>> {
  const activeTab = await getActiveTab()
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
      draft: await localMockAiProvider.generateComment(post),
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
  activePreparationCandidateId = candidateId

  try {
    await ensureAutomationAllowed()
    const settings = await getSettings()
    const currentActionCount = await getSessionActionCount()
    if (currentActionCount >= settings.maxActionsPerSession) {
      throw new AutomationError('INVALID_STATE', `Đã đạt giới hạn ${settings.maxActionsPerSession} thao tác trong phiên này.`)
    }
    const approved = await transitionCandidate(candidateId, 'PREPARING')
    const activeTab = await getActiveTab()
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
    return prepared
  } catch (error) {
    const classified = classifyAutomationError(error)
    await patchCandidate(candidateId, { state: 'FAILED', error: `${classified.code}: ${classified.message}` })
    throw classified
  } finally {
    activePreparationCandidateId = null
  }
}

async function processQueueTick(): Promise<void> {
  const safety = await getSafetyState()
  if (safety.emergencyStop) return

  const jobs = (await listJobs()).filter((job) => job.state === 'PENDING' && job.scheduledAt <= Date.now())
  for (const job of jobs.slice(0, 3)) {
    await updateJob(job.id, { state: 'PROCESSING', attempts: job.attempts + 1 })
    try {
      if (job.type === 'SCAN_FEED') {
        const result = await scanActiveTab(Number(job.payload.limit ?? 20))
        if (!result.ok) throw new Error(result.error)
        await updateJob(job.id, { state: 'SUCCESS', payload: { ...job.payload, result: result.data } })
      } else {
        await updateJob(job.id, { state: 'READY_FOR_REVIEW' })
      }
    } catch (error) {
      const current = (await listJobs()).find((item) => item.id === job.id)
      const shouldRetry = (current?.attempts ?? 1) < job.maxAttempts
      await updateJob(job.id, {
        state: shouldRetry ? 'PENDING' : 'FAILED',
        scheduledAt: Date.now() + 60_000,
        lastError: error instanceof Error ? error.message : 'Unknown queue error',
      })
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaultSettings()
  void chrome.alarms.create(QUEUE_ALARM, { periodInMinutes: 1 })
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
      if (message.type === 'QUEUE_LIST') {
        const response: ExtensionResponse<QueueJob[]> = { ok: true, data: await listJobs() }
        sendResponse(response)
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
