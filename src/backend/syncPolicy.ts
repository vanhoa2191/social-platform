import type { RemoteScheduleRecord } from './types'

export interface ScheduleSyncDecision {
  rowsToPush: RemoteScheduleRecord[]
  rowsToPull: RemoteScheduleRecord[]
  conflicts: string[]
}

function definitionKey(row: RemoteScheduleRecord): string {
  return JSON.stringify({
    name: row.name,
    enabled: row.enabled,
    intervalMinutes: row.intervalMinutes,
    maxPosts: row.maxPosts,
    startHour: row.startHour,
    endHour: row.endHour,
    accountContextKey: row.accountContextKey ?? null,
    accountLabel: row.accountLabel ?? null,
  })
}

export function resolveScheduleSync(
  localRows: RemoteScheduleRecord[],
  remoteRows: RemoteScheduleRecord[],
): ScheduleSyncDecision {
  const localById = new Map(localRows.map((row) => [row.localScheduleId, row]))
  const remoteById = new Map(remoteRows.map((row) => [row.localScheduleId, row]))
  const rowsToPush: RemoteScheduleRecord[] = []
  const rowsToPull: RemoteScheduleRecord[] = []
  const conflicts: string[] = []

  for (const local of localRows) {
    const remote = remoteById.get(local.localScheduleId)
    if (!remote) {
      rowsToPush.push(local)
      continue
    }
    if (local.revision > remote.revision) {
      rowsToPush.push(local)
      continue
    }
    if (remote.revision > local.revision) {
      conflicts.push(local.localScheduleId)
      continue
    }
    if (definitionKey(local) !== definitionKey(remote)) conflicts.push(local.localScheduleId)
  }

  for (const remote of remoteRows) {
    if (!localById.has(remote.localScheduleId)) rowsToPull.push(remote)
  }

  return { rowsToPush, rowsToPull, conflicts }
}

export function nextDefinitionRevision(localRevision: number, remoteRevision: number): number {
  return Math.max(1, Math.trunc(localRevision) || 1, Math.trunc(remoteRevision) || 0) + 1
}
