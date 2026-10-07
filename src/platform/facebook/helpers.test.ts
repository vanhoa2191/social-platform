import { describe, expect, it } from 'vitest'
import { buildAccountContextKey, classifyFacebookSurface, normalizeProfileUrl } from './helpers'

describe('facebook adapter helpers', () => {
  it('classifies common Facebook surfaces', () => {
    expect(classifyFacebookSurface('https://www.facebook.com/')).toBe('FEED')
    expect(classifyFacebookSurface('https://www.facebook.com/groups/example')).toBe('GROUP')
    expect(classifyFacebookSurface('https://www.facebook.com/somepage/posts/123')).toBe('POST')
    expect(classifyFacebookSurface('https://www.facebook.com/somepage')).toBe('PAGE')
  })

  it('normalizes profile URLs without tracking params', () => {
    expect(normalizeProfileUrl('/profile.php?id=123&ref=abc', 'https://www.facebook.com/'))
      .toBe('https://www.facebook.com/profile.php?id=123')
  })

  it('creates deterministic account keys', () => {
    expect(buildAccountContextKey('https://www.facebook.com/profile.php?id=123', 'Nguyen A'))
      .toBe(buildAccountContextKey('https://www.facebook.com/profile.php?id=123', 'Nguyen A'))
  })
})
