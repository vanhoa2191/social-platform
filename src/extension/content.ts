import { fingerprint, isSupportedFacebookUrl, normalizeText } from '../core/helpers'
import type { ContentRequest, ExtensionResponse, FeedPost, PageContext, PrepareCommentResult } from './types'

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

function postIdentity(node: Element): { id: string; text: string } {
  const text = normalizeText((node as HTMLElement).innerText ?? node.textContent ?? '')
  return {
    text,
    id: fingerprint([text.slice(0, 600), window.location.hostname]),
  }
}

function scanFeed(limit = 20): FeedPost[] {
  const nodes = Array.from(document.querySelectorAll('[role="article"], article'))
  const seen = new Set<string>()
  const posts: FeedPost[] = []

  for (const node of nodes) {
    if (posts.length >= Math.max(1, Math.min(limit, 100))) break

    const identity = postIdentity(node)
    if (identity.text.length < 40 || seen.has(identity.id)) continue
    seen.add(identity.id)

    posts.push({
      id: identity.id,
      text: identity.text,
      author: guessAuthor(node),
      sourceUrl: window.location.href,
      permalink: guessPermalink(node),
      capturedAt: Date.now(),
    })
  }

  return posts
}

function findPostElement(postId: string): HTMLElement | undefined {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[role="article"], article'))
  return nodes.find((node) => postIdentity(node).id === postId)
}

function isCommentControl(element: Element): boolean {
  const text = normalizeText([
    element.textContent,
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
  ].filter(Boolean).join(' ')).toLowerCase()
  return text.includes('bình luận') || text.includes('comment')
}

async function prepareComment(postId: string, comment: string): Promise<PrepareCommentResult> {
  const article = findPostElement(postId)
  if (!article) throw new Error('Không tìm thấy bài viết trong DOM hiện tại. Hãy cuộn lại bài rồi thử lại.')

  article.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const commentControl = Array.from(article.querySelectorAll('button,[role="button"]')).find(isCommentControl) as HTMLElement | undefined
  commentControl?.click()

  await new Promise((resolve) => window.setTimeout(resolve, 250))

  const localComposer = article.querySelector<HTMLElement>('[contenteditable="true"][role="textbox"], [contenteditable="true"]')
  const nearbyComposer = localComposer ?? Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"][role="textbox"]')).find((node) => {
    const rect = node.getBoundingClientRect()
    const articleRect = article.getBoundingClientRect()
    return Math.abs(rect.top - articleRect.bottom) < 500
  })

  if (!nearbyComposer) throw new Error('Không tìm thấy ô bình luận. Giao diện Facebook có thể đã thay đổi.')

  nearbyComposer.focus()
  nearbyComposer.textContent = comment
  nearbyComposer.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: comment,
  }))

  await new Promise((resolve) => window.setTimeout(resolve, 80))
  const composerText = normalizeText(nearbyComposer.innerText || nearbyComposer.textContent || '')
  const prepared = composerText.includes(normalizeText(comment).slice(0, Math.min(24, comment.length)))

  return { postId, prepared, composerText }
}

chrome.runtime.onMessage.addListener((message: ContentRequest, _sender, sendResponse) => {
  void (async () => {
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
        return
      }

      if (message.type === 'PREPARE_COMMENT') {
        const response: ExtensionResponse<PrepareCommentResult> = {
          ok: true,
          data: await prepareComment(message.postId, message.comment),
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
