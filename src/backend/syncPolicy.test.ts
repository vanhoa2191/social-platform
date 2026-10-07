import { describe, expect, it } from 'vitest'
import { resolveScheduleSync } from './syncPolicy'
import type { RemoteScheduleRecord } from './types'

function row(id: string, revision: number): RemoteScheduleRecord {
  return {
    localScheduleId: id,
    name: id,
    enabled: true,
    intervalMinutes: 60,
    maxPosts: 10,
    startHour: 8,
    endHour: 22,
    revision,
    lastSyncedAt: '2026-10-07T00:00:00.000Z',
  }
}

describe('schedule sync conflict policy', () => {
  it('pushes new and equal/newer local revisions', () => {
    const result = resolveScheduleSync(
      [row('new', 10), row('equal', 20), row('local-newer', 30)],
      [
        { localScheduleId: 'equal', revision: 20 },
        { localScheduleId: 'local-newer', revision: 29 },
      ],
    )

    expect(result.conflicts).toEqual([])
    expect(result.rowsToPush.map((item) => item.localScheduleId)).toEqual([
      'new',
      'equal',
      'local-newer',
    ])
  })

  it('never silently overwrites a newer remote revision', () => {
    const result = resolveScheduleSync(
      [row('conflict', 10), row('safe', 50)],
      [
        { localScheduleId: 'conflict', revision: 11 },
        { localScheduleId: 'safe', revision: 49 },
      ],
    )

    expect(result.conflicts).toEqual(['conflict'])
    expect(result.rowsToPush.map((item) => item.localScheduleId)).toEqual(['safe'])
  })
})
