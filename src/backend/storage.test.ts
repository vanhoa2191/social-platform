import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertLocalDataOwnership,
  claimLocalDataOwner,
  getEventWatermark,
  setEventWatermark,
} from './storage'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Firebase sync local data ownership', () => {
  it('binds local data to one Firebase user to prevent unintended cross-account uploads', async () => {
    await claimLocalDataOwner('user-a')
    await expect(claimLocalDataOwner('user-a')).resolves.toBeUndefined()
    await expect(claimLocalDataOwner('user-b')).rejects.toThrow(/tài khoản Firebase khác/)
  })

  it('rejects an invalid user and mismatching owner without overwriting ownership', () => {
    expect(() => assertLocalDataOwnership('user-a', 'user-b')).toThrow()
    expect(() => assertLocalDataOwnership(undefined, '')).toThrow()
    expect(() => assertLocalDataOwnership(undefined, 'user-a')).not.toThrow()
  })

  it('keeps telemetry event watermarks scoped to the authenticated Firebase UID', async () => {
    const cursorA = { createdAt: 1000, id: 'event-a' }
    await setEventWatermark('user-a', cursorA)
    expect(await getEventWatermark('user-a')).toEqual(cursorA)
    expect(await getEventWatermark('user-b')).toBeUndefined()
    await setEventWatermark('user-b', { createdAt: 2000, id: 'event-b' })
    expect(await getEventWatermark('user-a')).toEqual(cursorA)
  })
})
