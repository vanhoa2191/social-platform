import { isSupportedFacebookUrl } from '../core/helpers'
import { getPlatformAdapter } from '../platform/registry'
import type { AdapterDiagnostic, PlatformContext } from '../platform/types'
import type { ContentRequest, ExtensionResponse, FeedPost, PageContext, PrepareCommentResult } from './types'

function activeAdapter() {
  return getPlatformAdapter(window.location.href)
}

function getPageContext(): PageContext {
  return {
    url: window.location.href,
    title: document.title,
    isFacebook: isSupportedFacebookUrl(window.location.href),
  }
}

chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message.type === 'CONTENT_PING') {
        const response: ExtensionResponse<{ ready: true; adapterId: string }> = {
          ok: true,
          data: { ready: true, adapterId: activeAdapter()?.id ?? 'none' },
        }
        sendResponse(response)
        return
      }

      if (message.type === 'GET_PAGE_CONTEXT') {
        const response: ExtensionResponse<PageContext> = { ok: true, data: getPageContext() }
        sendResponse(response)
        return
      }

      if (message.type === 'GET_PLATFORM_CONTEXT') {
        const adapter = activeAdapter()
        if (!adapter) throw new Error('Không có platform adapter phù hợp với trang hiện tại.')
        const response: ExtensionResponse<PlatformContext> = { ok: true, data: adapter.getContext() }
        sendResponse(response)
        return
      }

      if (message.type === 'GET_ADAPTER_DIAGNOSTIC') {
        const adapter = activeAdapter()
        if (!adapter) throw new Error('Không có platform adapter phù hợp với trang hiện tại.')
        const response: ExtensionResponse<AdapterDiagnostic> = { ok: true, data: adapter.diagnose() }
        sendResponse(response)
        return
      }

      if (message.type === 'SCAN_FEED') {
        const adapter = activeAdapter()
        if (!adapter) {
          const response: ExtensionResponse = { ok: false, error: 'Trang hiện tại không thuộc facebook.com' }
          sendResponse(response)
          return
        }
        const response: ExtensionResponse<FeedPost[]> = { ok: true, data: adapter.scan(message.limit) }
        sendResponse(response)
        return
      }

      if (message.type === 'PREPARE_COMMENT') {
        const response: ExtensionResponse<PrepareCommentResult> = {
          ok: true,
          data: await (activeAdapter()?.prepareComment(message.postId, message.comment) ?? Promise.reject(new Error('Không có platform adapter phù hợp.'))),
        }
        sendResponse(response)
      }
    } catch (error) {
      const response: ExtensionResponse = {
        ok: false,
        error: error instanceof Error ? error.message : 'Content script error',
      }
      sendResponse(response)
    }
  })()
  return true
})
