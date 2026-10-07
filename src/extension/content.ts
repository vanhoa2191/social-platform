import { fingerprint, isSupportedFacebookUrl, normalizeText } from '../core/helpers'
import type { ContentRequest, ExtensionResponse, FeedPost, PageContext } from './types'

function getPageContext(): PageContext {
  return {
    url: window.location.href,
    title: document.title,
    isFacebook: isSupportedFacebookUrl(window.location.href),
  }
}

function guessAuthor(article: Element): string | undefined {
  const candidates = Array.from(article.querySelectorAll('h1,h2,h3,strong,a[role="link"]'))
    .map((node) => normalizeText(node.textContent ?? ''))
    .filter((value) => value.length >= 2 && value.length <= 80)
  return candidates[0]
}

function guessPermalink(article: Element): string | undefined {
  const anchors = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const match = anchors.find((anchor) => {
    const href = anchor.href
    return href.includes('/posts/') || href.includes('/permalink/') || href.includes('/reel/') || href.includes('story_fbid=')
  })
  return match?.href
}

function scanFeed(limit = 20): FeedPost[] {
  const nodes = Array.from(document.querySelectorAll('[role="article"], article'))
  const seen = new Set<string>()
  const posts: FeedPost[] = []

  for (const node of nodes) {
    if (posts.length >= Math.max(1, Math.min(limit, 100))) break

    const text = normalizeText((node as HTMLElement).innerText ?? node.textContent ?? '')
    if (text.length < 40) continue

    const id = fingerprint([text.slice(0, 600), window.location.hostname])
    if (seen.has(id)) continue
    seen.add(id)

    posts.push({
      id,
      text,
      author: guessAuthor(node),
      sourceUrl: window.location.href,
      permalink: guessPermalink(node),
      capturedAt: Date.now(),
    })
  }

  return posts
}

chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
  try {
    if (message.type === 'CONTENT_PING') {
      const response: ExtensionResponse<{ ready: true }> = { ok: true, data: { ready: true } }
      sendResponse(response)
      return
    }

    if (message.type === 'GET_PAGE_CONTEXT') {
      const response: ExtensionResponse<PageContext> = { ok: true, data: getPageContext() }
      sendResponse(response)
      return
    }

    if (message.type === 'SCAN_FEED') {
      const context = getPageContext()
      if (!context.isFacebook) {
        const response: ExtensionResponse = { ok: false, error: 'Trang hiện tại không thuộc facebook.com' }
        sendResponse(response)
        return
      }
      const response: ExtensionResponse<FeedPost[]> = { ok: true, data: scanFeed(message.limit) }
      sendResponse(response)
    }
  } catch (error) {
    const response: ExtensionResponse = {
      ok: false,
      error: error instanceof Error ? error.message : 'Content script error',
    }
    sendResponse(response)
  }
})
