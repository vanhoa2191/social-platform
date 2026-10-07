import { describe, expect, it } from 'vitest'
import { computeBackoffMs, withinLocalWindow } from './retry'

describe('retry helpers', () => {
  it('uses capped exponential backoff', () => {
    expect(computeBackoffMs(1)).toBe(60_000)
    expect(computeBackoffMs(3)).toBe(240_000)
    expect(computeBackoffMs(20)).toBe(30 * 60_000)
  })

  it('supports overnight windows', () => {
    expect(withinLocalWindow(new Date('2026-10-07T23:00:00'), 22, 6)).toBe(true)
    expect(withinLocalWindow(new Date('2026-10-07T12:00:00'), 22, 6)).toBe(false)
  })
})
