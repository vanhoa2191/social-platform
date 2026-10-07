import type { RemoteScheduleRecord } from './types'

export interface RemoteRevision {
  localScheduleId: string
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
    remoteRows.map((item) => [item.localScheduleId, Number(item.revision)]),
  )

  const conflicts = localRows
    .filter((row) => {
      const remote = remoteRevision.get(row.localScheduleId)
      return remote !== undefined && remote > row.revision
    })
    .map((row) => row.localScheduleId)

  const rowsToPush = localRows.filter((row) => {
    const remote = remoteRevision.get(row.localScheduleId)
    return remote === undefined || row.revision >= remote
  })

  return { rowsToPush, conflicts }
}
