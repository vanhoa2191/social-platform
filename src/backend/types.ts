export interface BrowserInstanceRecord {
  id?: string
  deviceKey: string
  name: string
  extensionVersion: string
  lastSeenAt: string
  metadata: Record<string, unknown>
}

export interface RemoteScheduleRecord {
  id?: string
  localScheduleId: string
  browserInstanceId?: string | null
  name: string
  enabled: boolean
  intervalMinutes: number
  maxPosts: number
  startHour: number
  endHour: number
  accountContextKey?: string | null
  accountLabel?: string | null
  revision: number
  definitionUpdatedAt: number
  lastSyncedAt: string
}

export interface SyncSummary {
  mode: 'local-only' | 'connected'
  provider: 'firebase'
  browserInstanceId?: string
  schedulesPushed: number
  schedulesPulled: number
  schedulesDeleted: number
  deletionConflicts: number
  deletionConflictScheduleIds: string[]
  eventsPushed: number
  remoteSchedules: number
  conflicts: number
  conflictScheduleIds: string[]
  telemetryEnabled: boolean
  syncedAt: number
}
