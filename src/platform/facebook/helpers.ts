import { fingerprint, normalizeText } from '../../core/helpers'
import type { PlatformSurface } from '../types'

export function classifyFacebookSurface(value: string): PlatformSurface {
  try {
    const url = new URL(value)
    const path = url.pathname.toLowerCase()
    if (path.includes('/groups/')) return 'GROUP'
    if (path.includes('/posts/') || path.includes('/permalink/') || path.includes('/reel/') || url.searchParams.has('story_fbid')) return 'POST'
    if (path === '/' || path === '/home.php') return 'FEED'
    if (path && path !== '/') return 'PAGE'
    return 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

export function normalizeProfileUrl(value: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(value, baseUrl)
    if (!url.hostname.endsWith('facebook.com')) return undefined
    url.hash = ''
    const allowedParams = new URLSearchParams()
    if (url.pathname === '/profile.php' && url.searchParams.get('id')) {
      allowedParams.set('id', url.searchParams.get('id')!)
    }
    url.search = allowedParams.toString()
    return url.toString()
  } catch {
    return undefined
  }
}

export function buildAccountContextKey(profileUrl: string | undefined, label: string): string {
  return `facebook:${fingerprint([profileUrl ?? '', normalizeText(label).toLowerCase()])}`
}
