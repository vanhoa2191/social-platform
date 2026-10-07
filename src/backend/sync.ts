import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import {
  applyRemoteSchedule,
  getPilotSettings,
  listRuntimeEvents,
  listSchedules,
  touchSchedule,
} from '../extension/client'
import type { RuntimeEvent } from '../runtime/types'
import { getFirebaseAuth, getFirestoreDb } from './client'
import { getEventWatermark, getOrCreateDeviceKey, setEventWatermark } from './storage'
import { resolveScheduleSync } from './syncPolicy'
import { telemetryConsentCutoff, toTelemetryEventRecord } from './telemetry'
import type { BrowserInstanceRecord, RemoteScheduleRecord, SyncSummary } from './types'

function extensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
}

async function getAuthModule() {
  return extensionRuntime()
    ? import('firebase/auth/web-extension')
    : import('firebase/auth')
}

async function requireSession(): Promise<{
  db: NonNullable<ReturnType<typeof getFirestoreDb>>
  user: User
}> {
  const [auth, db] = await Promise.all([getFirebaseAuth(), Promise.resolve(getFirestoreDb())])
  if (!auth || !db) throw new Error('Firebase backend chưa được cấu hình.')
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Hãy đăng nhập Firebase trước khi đồng bộ.')
  return { db, user }
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
    metadata: {
      runtime: extensionRuntime() ? 'extension' : 'web-preview',
    },
  }

  await setDoc(
    doc(db, 'users', user.uid, 'browserInstances', deviceKey),
    payload,
    { merge: true },
  )
  return deviceKey
}

export async function syncRuntimeData(extensionVersion: string): Promise<SyncSummary> {
  const db = getFirestoreDb()
  if (!db) {
    return {
      mode: 'local-only',
      provider: 'firebase',
      schedulesPushed: 0,
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

  const scheduleRows: RemoteScheduleRecord[] = schedulesResult.data.map((schedule) => ({
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
    revision: schedule.updatedAt,
    lastSyncedAt: new Date().toISOString(),
  }))

  const schedulesCollection = collection(db, 'users', user.uid, 'schedules')
  const remoteSnapshot = await getDocs(schedulesCollection)
  const remoteRows = remoteSnapshot.docs.map((item) => ({
    localScheduleId: item.id,
    revision: Number(item.data().revision ?? 0),
  }))

  const syncDecision = resolveScheduleSync(scheduleRows, remoteRows)
  const rowsToPush = syncDecision.rowsToPush

  if (rowsToPush.length) {
    const batch = writeBatch(db)
    for (const row of rowsToPush) {
      batch.set(
        doc(db, 'users', user.uid, 'schedules', row.localScheduleId),
        row,
        { merge: true },
      )
    }
    await batch.commit()
  }

  const pilotResult = await getPilotSettings()
  const telemetryEnabled = pilotResult.ok && pilotResult.data.telemetryOptIn
  let unsyncedEvents: RuntimeEvent[] = []

  if (telemetryEnabled && pilotResult.ok) {
    const watermark = await getEventWatermark()
    const consentCutoff = telemetryConsentCutoff(
      watermark,
      pilotResult.data.telemetryOptInAt,
    )
    const eventResult = await listRuntimeEvents(500)
    if (!eventResult.ok) throw new Error(eventResult.error)

    unsyncedEvents = eventResult.data
      .filter((event) => event.createdAt > consentCutoff)
      .sort((a, b) => a.createdAt - b.createdAt)

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
      await setEventWatermark(unsyncedEvents[unsyncedEvents.length - 1].createdAt)
    }
  }

  return {
    mode: 'connected',
    provider: 'firebase',
    browserInstanceId,
    schedulesPushed: rowsToPush.length,
    eventsPushed: unsyncedEvents.length,
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

export async function subscribeBackendAuth(
  listener: (email: string | undefined) => void,
): Promise<() => void> {
  const auth = await getFirebaseAuth()
  if (!auth) {
    listener(undefined)
    return () => undefined
  }
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
  const { db, user } = await requireSession()
  const snapshot = await getDoc(doc(db, 'users', user.uid, 'schedules', scheduleId))
  if (!snapshot.exists()) throw new Error('Không tìm thấy lịch cloud.')

  const data = snapshot.data() as RemoteScheduleRecord
  const applied = await applyRemoteSchedule({
    id: data.localScheduleId,
    name: data.name,
    enabled: data.enabled,
    intervalMinutes: data.intervalMinutes,
    maxPosts: data.maxPosts,
    startHour: data.startHour,
    endHour: data.endHour,
    accountBinding: data.accountContextKey
      ? {
          key: data.accountContextKey,
          label: data.accountLabel ?? 'Facebook account',
        }
      : undefined,
  }, Number(data.revision))

  if (!applied.ok) throw new Error(applied.error)
  return syncRuntimeData(extensionVersion)
}
