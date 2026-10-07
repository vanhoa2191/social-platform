import { describe, expect, it } from 'vitest'
import { resolveScheduleSync } from './syncPolicy'
import type { RemoteScheduleRecord } from './types'

function row(id: string, revision: number): RemoteScheduleRecord {
  return {
    local_schedule_id: id,
    name: id,
    enabled: true,
    interval_minutes: 60,
    max_posts: 10,
    start_hour: 8,
    end_hour: 22,
    revision,
    last_synced_at: '2026-10-07T00:00:00.000Z',
  }
}

describe('schedule sync conflict policy', () => {
  it('pushes new and equal/newer local revisions', () => {
    const result = resolveScheduleSync(
      [row('new', 10), row('equal', 20), row('local-newer', 30)],
      [
        { local_schedule_id: 'equal', revision: 20 },
        { local_schedule_id: 'local-newer', revision: 29 },
      ],
    )

    expect(result.conflicts).toEqual([])
    expect(result.rowsToPush.map((item) => item.local_schedule_id)).toEqual([
      'new',
      'equal',
      'local-newer',
    ])
  })

  it('never silently overwrites a newer remote revision', () => {
    const result = resolveScheduleSync(
      [row('conflict', 10), row('safe', 50)],
      [
        { local_schedule_id: 'conflict', revision: 11 },
        { local_schedule_id: 'safe', revision: 49 },
      ],
    )

    expect(result.conflicts).toEqual(['conflict'])
    expect(result.rowsToPush.map((item) => item.local_schedule_id)).toEqual(['safe'])
  })
})
