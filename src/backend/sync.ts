import type { Session } from '@supabase/supabase-js'
import { applyRemoteSchedule, listRuntimeEvents, listSchedules, touchSchedule } from '../extension/client'
import { getSupabaseClient } from './client'
import { getEventWatermark, getOrCreateDeviceKey, setEventWatermark } from './storage'
import type { BrowserInstanceRecord, RemoteScheduleRecord, SyncSummary } from './types'
import { resolveScheduleSync } from './syncPolicy'

async function requireSession(): Promise<{ client: NonNullable<ReturnType<typeof getSupabaseClient>>; session: Session }> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase backend chưa được cấu hình.')
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Hãy đăng nhập Supabase trước khi đồng bộ.')
  return { client, session: data.session }
}

export async function registerBrowserInstance(extensionVersion: string): Promise<string> {
  const { client } = await requireSession()
  const deviceKey = await getOrCreateDeviceKey()
  const payload: BrowserInstanceRecord = {
    device_key: deviceKey,
    name: navigator.userAgent.includes('Chrome') ? 'Chrome Extension' : 'Web Preview',
    extension_version: extensionVersion,
    last_seen_at: new Date().toISOString(),
    metadata: {
      userAgent: navigator.userAgent.slice(0, 240),
      language: navigator.language,
    },
  }

  const { data, error } = await client
    .from('browser_instances')
    .upsert(payload, { onConflict: 'user_id,device_key' })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

export async function syncRuntimeData(extensionVersion: string): Promise<SyncSummary> {
  const client = getSupabaseClient()
  if (!client) {
    return {
      mode: 'local-only',
      schedulesPushed: 0,
      eventsPushed: 0,
      remoteSchedules: 0,
      conflicts: 0,
      conflictScheduleIds: [],
      syncedAt: Date.now(),
    }
  }

  await requireSession()
  const browserInstanceId = await registerBrowserInstance(extensionVersion)
  const schedulesResult = await listSchedules()
  if (!schedulesResult.ok) throw new Error(schedulesResult.error)

  const scheduleRows: RemoteScheduleRecord[] = schedulesResult.data.map((schedule) => ({
    local_schedule_id: schedule.id,
    browser_instance_id: browserInstanceId,
    name: schedule.name,
    enabled: schedule.enabled,
    interval_minutes: schedule.intervalMinutes,
    max_posts: schedule.maxPosts,
    start_hour: schedule.startHour,
    end_hour: schedule.endHour,
    account_context_key: schedule.accountBinding?.key ?? null,
    account_label: schedule.accountBinding?.label ?? null,
    revision: schedule.updatedAt,
    last_synced_at: new Date().toISOString(),
  }))

  const { data: remoteSchedules, error: remoteError } = await client
    .from('schedule_definitions')
    .select('local_schedule_id, revision')
  if (remoteError) throw remoteError

  const syncDecision = resolveScheduleSync(
    scheduleRows,
    (remoteSchedules ?? []).map((item) => ({
      local_schedule_id: item.local_schedule_id as string,
      revision: Number(item.revision),
    })),
  )
  const rowsToPush = syncDecision.rowsToPush
  const conflicts = syncDecision.conflicts.length

  if (rowsToPush.length) {
    const { error } = await client
      .from('schedule_definitions')
      .upsert(rowsToPush, { onConflict: 'user_id,local_schedule_id' })
    if (error) throw error
  }

  const watermark = await getEventWatermark()
  const eventResult = await listRuntimeEvents(500)
  if (!eventResult.ok) throw new Error(eventResult.error)

  const unsyncedEvents = eventResult.data
    .filter((event) => event.createdAt > watermark)
    .sort((a, b) => a.createdAt - b.createdAt)

  if (unsyncedEvents.length) {
    const { error } = await client.from('analytics_events').upsert(
      unsyncedEvents.map((event) => ({
        browser_instance_id: browserInstanceId,
        local_event_id: event.id,
        event_type: event.category.toLowerCase(),
        category: event.category,
        level: event.level,
        payload: {
          message: event.message,
          detail: event.detail,
        },
        occurred_at: new Date(event.createdAt).toISOString(),
      })),
      { onConflict: 'user_id,browser_instance_id,local_event_id', ignoreDuplicates: true },
    )
    if (error) throw error
    await setEventWatermark(unsyncedEvents[unsyncedEvents.length - 1].createdAt)
  }

  return {
    mode: 'connected',
    browserInstanceId,
    schedulesPushed: rowsToPush.length,
    eventsPushed: unsyncedEvents.length,
    remoteSchedules: remoteSchedules?.length ?? 0,
    conflicts,
    conflictScheduleIds: syncDecision.conflicts,
    syncedAt: Date.now(),
  }
}

export async function getCurrentUserEmail(): Promise<string | undefined> {
  const client = getSupabaseClient()
  if (!client) return undefined
  const { data } = await client.auth.getUser()
  return data.user?.email
}

export async function sendMagicLink(email: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase backend chưa được cấu hình.')
  const redirectTo = typeof window !== 'undefined' ? window.location.href : undefined
  const { error } = await client.auth.signInWithOtp({
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  })
  if (error) throw error
}

export async function signOutBackend(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  const { error } = await client.auth.signOut()
  if (error) throw error
}


export async function resolveScheduleConflictKeepLocal(
  scheduleId: string,
  extensionVersion: string,
): Promise<SyncSummary> {
  const touched = await touchSchedule(scheduleId)
  if (!touched.ok) throw new Error(touched.error)
  return syncRuntimeData(extensionVersion)
}

export async function resolveScheduleConflictUseCloud(
  scheduleId: string,
  extensionVersion: string,
): Promise<SyncSummary> {
  const { client } = await requireSession()
  const { data, error } = await client
    .from('schedule_definitions')
    .select('local_schedule_id,name,enabled,interval_minutes,max_posts,start_hour,end_hour,account_context_key,account_label,revision')
    .eq('local_schedule_id', scheduleId)
    .single()

  if (error) throw error
  const applied = await applyRemoteSchedule({
    id: data.local_schedule_id as string,
    name: data.name as string,
    enabled: Boolean(data.enabled),
    intervalMinutes: Number(data.interval_minutes),
    maxPosts: Number(data.max_posts),
    startHour: Number(data.start_hour),
    endHour: Number(data.end_hour),
    accountBinding: data.account_context_key
      ? {
          key: data.account_context_key as string,
          label: (data.account_label as string | null) ?? 'Facebook account',
        }
      : undefined,
  }, Number(data.revision))

  if (!applied.ok) throw new Error(applied.error)
  return syncRuntimeData(extensionVersion)
}
