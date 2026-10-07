export function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

export function isSupportedFacebookUrl(value?: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname === 'www.facebook.com')
  } catch {
    return false
  }
}

export function fingerprint(parts: Array<string | number | boolean | null | undefined>): string {
  const input = parts.map((part) => String(part ?? '')).join('|')
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
