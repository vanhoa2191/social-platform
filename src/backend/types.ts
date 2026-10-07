export interface BrowserInstanceRecord {
  id?: string
  device_key: string
  name: string
  extension_version: string
  last_seen_at: string
  metadata: Record<string, unknown>
}

export interface RemoteScheduleRecord {
  id?: string
  local_schedule_id: string
  browser_instance_id?: string | null
  name: string
  enabled: boolean
  interval_minutes: number
  max_posts: number
  start_hour: number
  end_hour: number
  account_context_key?: string | null
  account_label?: string | null
  revision: number
  last_synced_at: string
}

export interface SyncSummary {
  mode: 'local-only' | 'connected'
  browserInstanceId?: string
  schedulesPushed: number
  eventsPushed: number
  remoteSchedules: number
  conflicts: number
  syncedAt: number
}
