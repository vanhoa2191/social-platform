import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import type { ReviewSchedule } from '../runtime/types'
import {
  applyRemoteSchedule,
  getPilotSettings,
  listRuntimeEventsAfter,
  listSchedules,
  touchSchedule,
} from '../extension/client'
import { getFirebaseAuth, getFirestoreDb } from './client'
import { getEventWatermark, getOrCreateDeviceKey, setEventWatermark } from './storage'
import { resolveScheduleSync } from './syncPolicy'
import { eventCursor, telemetryStartCursor, toTelemetryEventRecord } from './telemetry'
import type { BrowserInstanceRecord, RemoteScheduleRecord, SyncSummary } from './types'

function extensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
}

async function getAuthModule() {
  return extensionRuntime() ? import('firebase/auth/web-extension') : import('firebase/auth')
}

async function requireSession(): Promise<{ db: NonNullable<ReturnType<typeof getFirestoreDb>>; user: User }> {
  const [auth, db] = await Promise.all([getFirebaseAuth(), Promise.resolve(getFirestoreDb())])
  if (!auth || !db) throw new Error('Firebase backend chưa được cấu hình.')
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Hãy đăng nhập Firebase trước khi đồng bộ.')
  return { db, user }
}

function toRemoteSchedule(schedule: ReviewSchedule, browserInstanceId: string, syncedAt: string): RemoteScheduleRecord {
  return {
    id: schedule.id,
    localScheduleId: schedule.id,
    browserInstanceId,
    name: schedule.name,
    enabled: schedule.enabled,
    intervalMinutes: schedule.intervalMinutes,
    maxPosts: schedule.maxPosts,
    startHour: schedule.startHour,
    endHour: schedule.endHour,
    accountContextKey: schedule.accountBinding?.key ?? null,
    accountLabel: schedule.accountBinding?.label ?? null,
    revision: Math.max(1, Number(schedule.definitionRevision ?? 1)),
    definitionUpdatedAt: Number(schedule.definitionUpdatedAt ?? schedule.updatedAt ?? Date.now()),
    lastSyncedAt: syncedAt,
  }
}

function normalizeRemoteSchedule(id: string, value: Record<string, unknown>): RemoteScheduleRecord {
  return {
    id,
    localScheduleId: typeof value.localScheduleId === 'string' ? value.localScheduleId : id,
    browserInstanceId: typeof value.browserInstanceId === 'string' ? value.browserInstanceId : null,
    name: typeof value.name === 'string' ? value.name : 'Lịch quét Facebook',
    enabled: Boolean(value.enabled),
    intervalMinutes: Number(value.intervalMinutes ?? 60),
    maxPosts: Number(value.maxPosts ?? 5),
    startHour: Number(value.startHour ?? 8),
    endHour: Number(value.endHour ?? 22),
    accountContextKey: typeof value.accountContextKey === 'string' ? value.accountContextKey : null,
    accountLabel: typeof value.accountLabel === 'string' ? value.accountLabel : null,
    revision: Math.max(1, Number(value.revision ?? 1)),
    definitionUpdatedAt: Number(value.definitionUpdatedAt ?? Date.now()),
    lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : new Date(0).toISOString(),
  }
}

async function applyRemoteRow(row: RemoteScheduleRecord): Promise<void> {
  const applied = await applyRemoteSchedule({
    id: row.localScheduleId,
    name: row.name,
    enabled: row.enabled,
    intervalMinutes: row.intervalMinutes,
    maxPosts: row.maxPosts,
    startHour: row.startHour,
    endHour: row.endHour,
    accountBinding: row.accountContextKey ? {
      key: row.accountContextKey,
      label: row.accountLabel ?? 'Facebook account',
    } : undefined,
  }, row.revision, row.definitionUpdatedAt)
  if (!applied.ok) throw new Error(applied.error)
}

export async function registerBrowserInstance(extensionVersion: string): Promise<string> {
  const { db, user } = await requireSession()
  const deviceKey = await getOrCreateDeviceKey()
  const payload: BrowserInstanceRecord = {
    id: deviceKey,
    deviceKey,
    name: extensionRuntime() ? 'Chrome Extension' : 'Web Preview',
    extensionVersion,
    lastSeenAt: new Date().toISOString(),
    metadata: { runtime: extensionRuntime() ? 'extension' : 'web-preview' },
  }
  await setDoc(doc(db, 'users', user.uid, 'browserInstances', deviceKey), payload, { merge: true })
  return deviceKey
}

export async function syncRuntimeData(extensionVersion: string): Promise<SyncSummary> {
  const db = getFirestoreDb()
  if (!db) {
    return {
      mode: 'local-only',
      provider: 'firebase',
      schedulesPushed: 0,
      schedulesPulled: 0,
      eventsPushed: 0,
      remoteSchedules: 0,
      conflicts: 0,
      conflictScheduleIds: [],
      telemetryEnabled: false,
      syncedAt: Date.now(),
    }
  }

  const { user } = await requireSession()
  const browserInstanceId = await registerBrowserInstance(extensionVersion)
  const schedulesResult = await listSchedules()
  if (!schedulesResult.ok) throw new Error(schedulesResult.error)

  const syncedAt = new Date().toISOString()
  const scheduleRows = schedulesResult.data.map((schedule) => toRemoteSchedule(schedule, browserInstanceId, syncedAt))
  const schedulesCollection = collection(db, 'users', user.uid, 'schedules')
  const remoteSnapshot = await getDocs(schedulesCollection)
  const remoteRows = remoteSnapshot.docs.map((item) => normalizeRemoteSchedule(item.id, item.data()))
  const syncDecision = resolveScheduleSync(scheduleRows, remoteRows)

  for (const row of syncDecision.rowsToPull) await applyRemoteRow(row)

  if (syncDecision.rowsToPush.length) {
    const batch = writeBatch(db)
    for (const row of syncDecision.rowsToPush) {
      batch.set(doc(db, 'users', user.uid, 'schedules', row.localScheduleId), {
        ...row,
        browserInstanceId,
        lastSyncedAt: syncedAt,
      }, { merge: true })
    }
    await batch.commit()
  }

  const pilotResult = await getPilotSettings()
  const telemetryEnabled = pilotResult.ok && pilotResult.data.telemetryOptIn
  let eventsPushed = 0

  if (telemetryEnabled && pilotResult.ok) {
    const watermark = await getEventWatermark()
    const startCursor = telemetryStartCursor(watermark, pilotResult.data.telemetryOptInAt)
    const eventResult = await listRuntimeEventsAfter(startCursor, 500)
    if (!eventResult.ok) throw new Error(eventResult.error)
    const unsyncedEvents = eventResult.data
    if (unsyncedEvents.length) {
      const batch = writeBatch(db)
      for (const event of unsyncedEvents) {
        batch.set(
          doc(db, 'users', user.uid, 'analyticsEvents', event.id),
          toTelemetryEventRecord(event, browserInstanceId),
          { merge: true },
        )
      }
      await batch.commit()
      await setEventWatermark(eventCursor(unsyncedEvents[unsyncedEvents.length - 1]))
      eventsPushed = unsyncedEvents.length
    }
  }

  return {
    mode: 'connected',
    provider: 'firebase',
    browserInstanceId,
    schedulesPushed: syncDecision.rowsToPush.length,
    schedulesPulled: syncDecision.rowsToPull.length,
    eventsPushed,
    remoteSchedules: remoteSnapshot.size,
    conflicts: syncDecision.conflicts.length,
    conflictScheduleIds: syncDecision.conflicts,
    telemetryEnabled,
    syncedAt: Date.now(),
  }
}

export async function getCurrentUserEmail(): Promise<string | undefined> {
  const auth = await getFirebaseAuth()
  if (!auth) return undefined
  await auth.authStateReady()
  return auth.currentUser?.email ?? undefined
}

export async function subscribeBackendAuth(listener: (email: string | undefined) => void): Promise<() => void> {
  const auth = await getFirebaseAuth()
  if (!auth) { listener(undefined); return () => undefined }
  const { onAuthStateChanged } = await getAuthModule()
  return onAuthStateChanged(auth, (user) => listener(user?.email ?? undefined))
}

export async function signInBackend(email: string, password: string): Promise<void> {
  const auth = await getFirebaseAuth()
  if (!auth) throw new Error('Firebase backend chưa được cấu hình.')
  const { signInWithEmailAndPassword } = await getAuthModule()
  await signInWithEmailAndPassword(auth, email, password)
}

export async function createBackendAccount(email: string, password: string): Promise<void> {
  const auth = await getFirebaseAuth()
  if (!auth) throw new Error('Firebase backend chưa được cấu hình.')
  const { createUserWithEmailAndPassword } = await getAuthModule()
  await createUserWithEmailAndPassword(auth, email, password)
}

export async function sendBackendPasswordReset(email: string): Promise<void> {
  const auth = await getFirebaseAuth()
  if (!auth) throw new Error('Firebase backend chưa được cấu hình.')
  const { sendPasswordResetEmail } = await getAuthModule()
  await sendPasswordResetEmail(auth, email)
}

export async function signOutBackend(): Promise<void> {
  const auth = await getFirebaseAuth()
  if (!auth) return
  const { signOut } = await getAuthModule()
  await signOut(auth)
}

export async function resolveScheduleConflictKeepLocal(scheduleId: string, extensionVersion: string): Promise<SyncSummary> {
  const touched = await touchSchedule(scheduleId)
  if (!touched.ok) throw new Error(touched.error)
  return syncRuntimeData(extensionVersion)
}

export async function resolveScheduleConflictUseCloud(scheduleId: string, extensionVersion: string): Promise<SyncSummary> {
  const { db, user } = await requireSession()
  const snapshot = await getDoc(doc(db, 'users', user.uid, 'schedules', scheduleId))
  if (!snapshot.exists()) throw new Error('Không tìm thấy lịch cloud.')
  await applyRemoteRow(normalizeRemoteSchedule(snapshot.id, snapshot.data()))
  return syncRuntimeData(extensionVersion)
}
