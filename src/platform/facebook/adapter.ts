import { fingerprint, isSupportedFacebookUrl, normalizeText } from '../../core/helpers'
import type { FeedPost, PrepareCommentResult } from '../../extension/types'
import type { AccountContext, AdapterDiagnostic, PlatformAdapter, PlatformContext } from '../types'
import { buildAccountContextKey, classifyFacebookSurface, normalizeProfileUrl } from './helpers'
import { facebookSelectors } from './selectors'

function uniqueArticles(): HTMLElement[] {
  const seen = new Set<Element>()
  const result: HTMLElement[] = []
  for (const selector of facebookSelectors.articles) {
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      if (!seen.has(node)) {
        seen.add(node)
        result.push(node)
      }
    }
  }
  return result
}

function visibleText(node: Element): string {
  return normalizeText((node as HTMLElement).innerText ?? node.textContent ?? '')
}

function guessAuthor(article: Element): string | undefined {
  return Array.from(article.querySelectorAll('h1,h2,h3,strong,a[role="link"]'))
    .map((node) => normalizeText(node.textContent ?? ''))
    .find((value) => value.length >= 2 && value.length <= 80)
}

function canonicalPermalink(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, window.location.href)
    if (!isSupportedFacebookUrl(url.href)) return undefined
    const kept = new URL(url.origin + url.pathname)
    for (const key of ['story_fbid', 'id', 'fbid', 'set']) {
      const item = url.searchParams.get(key)
      if (item) kept.searchParams.set(key, item)
    }
    return kept.href
  } catch { return undefined }
}

function guessPermalink(article: Element): string | undefined {
  return canonicalPermalink(Array.from(article.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .find((anchor) => {
      const href = anchor.href
      return href.includes('/posts/') || href.includes('/permalink/') || href.includes('/reel/') || href.includes('story_fbid=')
    })?.href)
}

function canonicalPostKey(permalink?: string): string | undefined {
  if (!permalink) return undefined
  try {
    const url = new URL(permalink, window.location.href)
    const storyId = url.searchParams.get('story_fbid')
    if (storyId) return `story:${storyId}`
    const match = url.pathname.match(/\/(?:posts|permalink|reel)\/([^/?#]+)/)
    if (match?.[1]) return `path:${match[1]}`
    return undefined
  } catch {
    return undefined
  }
}

function postIdentity(node: Element): { id: string; text: string; permalink?: string; stable: boolean } {
  const text = visibleText(node)
  const permalink = guessPermalink(node)
  const stableKey = canonicalPostKey(permalink)
  return {
    text,
    permalink,
    stable: Boolean(stableKey),
    id: stableKey
      ? `fb:${stableKey}`
      : `fallback:${fingerprint([guessAuthor(node) ?? '', text.slice(0, 1200), window.location.hostname])}`,
  }
}

function profileCandidates(): Array<{ label: string; url?: string; evidence: string }> {
  const results: Array<{ label: string; url?: string; evidence: string }> = []
  const visited = new Set<Element>()

  for (const selector of facebookSelectors.profileAnchors) {
    for (const anchor of document.querySelectorAll<HTMLAnchorElement>(selector)) {
      if (visited.has(anchor)) continue
      visited.add(anchor)
      const label = normalizeText(
        anchor.textContent ||
        anchor.getAttribute('title') ||
        anchor.getAttribute('aria-label') ||
        '',
      )
      if (label.length < 2 || label.length > 120) continue
      const url = normalizeProfileUrl(anchor.href, window.location.href)
      results.push({ label, url, evidence: selector })
    }
  }

  return results
}

function detectAccountContext(): AccountContext | undefined {
  const candidates = profileCandidates()
  if (!candidates.length) return undefined

  const withProfileId = candidates.find((candidate) => candidate.url?.includes('/profile.php?id='))
  const candidate = withProfileId ?? candidates[0]
  const evidence = candidates
    .filter((item) => item.label === candidate.label || item.url === candidate.url)
    .map((item) => item.evidence)
    .slice(0, 4)

  const strongUrl = Boolean(candidate.url?.includes('/profile.php?id='))
  const profileAriaEvidence = evidence.some((item) => item.includes('aria-label'))
  const verified = Boolean(candidate.url && (strongUrl || profileAriaEvidence))

  return {
    platform: 'facebook',
    key: buildAccountContextKey(candidate.url, candidate.label),
    label: candidate.label,
    profileUrl: candidate.url,
    confidence: verified ? 'HIGH' : candidate.url ? 'MEDIUM' : 'LOW',
    verified,
    evidence,
  }
}

function getContext(): PlatformContext {
  return {
    platform: 'facebook',
    url: window.location.href,
    title: document.title,
    surface: classifyFacebookSurface(window.location.href),
    account: detectAccountContext(),
  }
}

function scan(limit = 20): FeedPost[] {
  const context = getContext()
  const seen = new Set<string>()
  const posts: FeedPost[] = []

  for (const node of uniqueArticles()) {
    if (posts.length >= Math.max(1, Math.min(limit, 100))) break
    const identity = postIdentity(node)
    if (identity.text.length < 40 || seen.has(identity.id)) continue
    seen.add(identity.id)

    posts.push({
      id: identity.id,
      text: identity.text,
      author: guessAuthor(node),
      sourceUrl: window.location.href,
      permalink: identity.permalink,
      capturedAt: Date.now(),
      surface: context.surface,
      accountContextKey: context.account?.key,
      accountLabel: context.account?.label,
    })
  }

  return posts
}

function isCommentControl(element: Element): boolean {
  const text = normalizeText([
    element.textContent,
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
  ].filter(Boolean).join(' ')).toLowerCase()
  return text.includes('bình luận') || text.includes('comment')
}

function findPostElement(postId: string): HTMLElement | undefined {
  if (!postId.startsWith('fb:')) {
    throw new Error('Bài viết không có permalink ổn định; để an toàn, adapter không tự chuẩn bị bình luận cho bài này.')
  }
  const matches = uniqueArticles().filter((node) => postIdentity(node).id === postId)
  if (matches.length > 1) {
    throw new Error('Có nhiều bài viết trùng định danh trong DOM; đã dừng để tránh nhập nhầm bình luận.')
  }
  return matches[0]
}

function findLocalComposer(article: HTMLElement): HTMLElement | undefined {
  const candidates = Array.from(article.querySelectorAll<HTMLElement>(facebookSelectors.composer.join(',')))
    .filter((node) => node.getAttribute('aria-hidden') !== 'true')
  if (candidates.length > 1) {
    throw new Error('Có nhiều ô bình luận trong cùng bài viết; đã dừng để tránh nhập nhầm.')
  }
  return candidates[0]
}

async function waitForComposer(article: HTMLElement, timeoutMs = 3500): Promise<HTMLElement | undefined> {
  const initial = findLocalComposer(article)
  if (initial) return initial

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      try {
        const candidate = findLocalComposer(article)
        if (!candidate) return
        observer.disconnect()
        window.clearTimeout(timer)
        resolve(candidate)
      } catch (error) {
        observer.disconnect()
        window.clearTimeout(timer)
        reject(error)
      }
    })
    const timer = window.setTimeout(() => {
      observer.disconnect()
      resolve(undefined)
    }, timeoutMs)
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
  })
}

async function prepareComment(postId: string, comment: string): Promise<PrepareCommentResult> {
  const article = findPostElement(postId)
  if (!article) throw new Error('Không tìm thấy bài viết trong DOM hiện tại. Hãy cuộn lại bài rồi thử lại.')

  article.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const commentControl = Array.from(article.querySelectorAll(facebookSelectors.commentControls.join(',')))
    .find(isCommentControl) as HTMLElement | undefined
  commentControl?.click()

  const composer = await waitForComposer(article)
  if (!composer) {
    throw new Error('Không xác định được ô bình luận thuộc đúng bài viết; đã dừng để tránh nhập nhầm.')
  }

  composer.focus()
  composer.textContent = comment
  composer.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: comment,
  }))

  await new Promise((resolve) => window.setTimeout(resolve, 80))
  const composerText = normalizeText(composer.innerText || composer.textContent || '')
  const prepared = composerText === normalizeText(comment)

  return { postId, prepared, composerText }
}

function diagnose(): AdapterDiagnostic {
  const articles = uniqueArticles()
  const composers = document.querySelectorAll(facebookSelectors.composer.join(',')).length
  const accountCandidates = profileCandidates()
  const context = getContext()
  const warnings: string[] = []

  if (!articles.length) warnings.push('Không tìm thấy article trong DOM hiện tại.')
  if (!context.account) warnings.push('Chưa nhận diện được account context.')
  else if (!context.account.verified) warnings.push('Account context mới ở mức suy luận, chưa đủ bằng chứng để bind scheduler.')
  if (context.surface === 'UNKNOWN') warnings.push('Không xác định được loại bề mặt Facebook.')

  const health = !isSupportedFacebookUrl(window.location.href)
    ? 'UNAVAILABLE'
    : warnings.length > 0
      ? 'DEGRADED'
      : 'HEALTHY'

  return {
    adapterId: 'facebook-web-v1',
    health,
    surface: context.surface,
    articleCount: articles.length,
    composerCount: composers,
    accountEvidenceCount: accountCandidates.length,
    warnings,
    checkedAt: Date.now(),
  }
}

export const facebookAdapter: PlatformAdapter = {
  id: 'facebook-web-v1',
  canHandle: isSupportedFacebookUrl,
  getContext,
  diagnose,
  scan,
  prepareComment,
}
