import { describe, expect, it } from 'vitest'
import { fingerprint, isSupportedFacebookUrl, normalizeText } from './helpers'

describe('normalizeText', () => {
  it('collapses whitespace and non-breaking spaces', () => {
    expect(normalizeText('  Xin\u00a0chào   bạn \n hôm nay ')).toBe('Xin chào bạn hôm nay')
  })
})

describe('isSupportedFacebookUrl', () => {
  it('accepts facebook web URLs', () => {
    expect(isSupportedFacebookUrl('https://www.facebook.com/')).toBe(true)
    expect(isSupportedFacebookUrl('https://facebook.com/groups/example')).toBe(true)
  })

  it('rejects unrelated and invalid URLs', () => {
    expect(isSupportedFacebookUrl('https://example.com')).toBe(false)
    expect(isSupportedFacebookUrl('not-a-url')).toBe(false)
  })
})

describe('fingerprint', () => {
  it('is deterministic and sensitive to input changes', () => {
    expect(fingerprint(['a', 1])).toBe(fingerprint(['a', 1]))
    expect(fingerprint(['a', 1])).not.toBe(fingerprint(['a', 2]))
  })
})
