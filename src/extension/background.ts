import { isSupportedFacebookUrl } from '../core/helpers'
import { clearQueue, countJobs, enqueueJob, listJobs, updateJob } from './queue'
import { ensureDefaultSettings } from './storage'
import type { BackgroundRequest, ContentRequest, ExtensionResponse, FeedPost, QueueJob, RuntimeStatus } from './types'

const QUEUE_ALARM = 'autotool.queue.tick'

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

async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const activeTab = await getActiveTab()
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

async function processQueueTick(): Promise<void> {
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
        const response: ExtensionResponse<{ pong: true; version: string }> = {
          ok: true,
          data: { pong: true, version: chrome.runtime.getManifest().version },
        }
        sendResponse(response)
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
        const response: ExtensionResponse<{ cleared: true }> = { ok: true, data: { cleared: true } }
        sendResponse(response)
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

