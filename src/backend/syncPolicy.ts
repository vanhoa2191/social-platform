import type { RemoteScheduleRecord } from './types'

export interface RemoteRevision {
  local_schedule_id: string
  revision: number | string
}

export interface ScheduleSyncDecision {
  rowsToPush: RemoteScheduleRecord[]
  conflicts: string[]
}

export function resolveScheduleSync(
  localRows: RemoteScheduleRecord[],
  remoteRows: RemoteRevision[],
): ScheduleSyncDecision {
  const remoteRevision = new Map(
    remoteRows.map((item) => [item.local_schedule_id, Number(item.revision)]),
  )

  const conflicts = localRows
    .filter((row) => {
      const remote = remoteRevision.get(row.local_schedule_id)
      return remote !== undefined && remote > row.revision
    })
    .map((row) => row.local_schedule_id)

  const rowsToPush = localRows.filter((row) => {
    const remote = remoteRevision.get(row.local_schedule_id)
    return remote === undefined || row.revision >= remote
  })

  return { rowsToPush, conflicts }
}
