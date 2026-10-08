import { describe, expect, it } from 'vitest'
import { nextDefinitionRevision, resolveScheduleSync } from './syncPolicy'
import type { RemoteScheduleRecord } from './types'

function row(id: string, revision: number, overrides: Partial<RemoteScheduleRecord> = {}): RemoteScheduleRecord {
  return {
    id,
    localScheduleId: id,
    name: id,
    enabled: true,
    intervalMinutes: 60,
    maxPosts: 10,
    startHour: 8,
    endHour: 22,
    accountContextKey: null,
    accountLabel: null,
    revision,
    definitionUpdatedAt: 1000 + revision,
    lastSyncedAt: '2026-10-07T00:00:00.000Z',
    ...overrides,
  }
}

describe('schedule sync conflict policy', () => {
  it('rebases Keep Local above the newest revision', () => {
    expect(nextDefinitionRevision(10, 11)).toBe(12)
    expect(nextDefinitionRevision(20, 5)).toBe(21)
  })

  it('pushes local-only/newer rows and ignores equal definitions', () => {
    const result = resolveScheduleSync(
      [row('new',1),row('equal',20),row('local-newer',30)],
      [row('equal',20),row('local-newer',29)],
    )
    expect(result.conflicts).toEqual([])
    expect(result.rowsToPull).toEqual([])
    expect(result.rowsToPush.map((item)=>item.localScheduleId)).toEqual(['new','local-newer'])
  })

  it('imports remote-only schedules', () => {
    const result = resolveScheduleSync([row('local',2)],[row('local',2),row('remote-only',4)])
    expect(result.rowsToPull.map((item)=>item.localScheduleId)).toEqual(['remote-only'])
  })

  it('never silently overwrites a newer remote revision', () => {
    const result = resolveScheduleSync([row('conflict',10),row('safe',50)],[row('conflict',11),row('safe',49)])
    expect(result.conflicts).toEqual(['conflict'])
    expect(result.rowsToPush.map((item)=>item.localScheduleId)).toEqual(['safe'])
  })

  it('treats equal revisions with different definitions as conflict', () => {
    const result = resolveScheduleSync([row('same',7,{maxPosts:5})],[row('same',7,{maxPosts:10})])
    expect(result.conflicts).toEqual(['same'])
  })
})
