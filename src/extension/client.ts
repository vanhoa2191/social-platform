import type { ExtensionResponse, FeedPost, RuntimeStatus } from './types'

function runtimeAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
}

async function send<T>(message: unknown): Promise<ExtensionResponse<T>> {
  if (!runtimeAvailable()) {
    return { ok: false, error: 'Dashboard đang chạy ở chế độ web preview, chưa phải Chrome Extension.' }
  }
  try {
    return await chrome.runtime.sendMessage(message) as ExtensionResponse<T>
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không kết nối được Extension runtime.' }
  }
}

export function isExtensionRuntime(): boolean {
  return runtimeAvailable()
}

export function getRuntimeStatus(): Promise<ExtensionResponse<RuntimeStatus>> {
  return send<RuntimeStatus>({ type: 'GET_RUNTIME_STATUS' })
}

export function scanActiveFacebookTab(limit = 20): Promise<ExtensionResponse<FeedPost[]>> {
  return send<FeedPost[]>({ type: 'SCAN_ACTIVE_TAB', limit })
}
