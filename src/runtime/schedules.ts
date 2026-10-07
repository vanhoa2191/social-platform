import { SCHEDULES_STORE, openRuntimeDb, requestToPromise, transactionDone } from '../extension/runtimeDb'
import { withinLocalWindow } from './retry'
import type { ReviewSchedule, ReviewScheduleInput } from './types'

function nextRun(intervalMinutes: number, now = Date.now()): number {
  return now + Math.max(15, intervalMinutes) * 60_000
}

function normalizedDefinition(input: ReviewScheduleInput, existing?: ReviewSchedule) {
  return {
    name: input.name.trim() || 'Lịch quét Facebook',
    enabled: input.enabled,
    intervalMinutes: Math.max(15, Math.min(1440, input.intervalMinutes)),
    maxPosts: Math.max(1, Math.min(20, input.maxPosts)),
    startHour: Math.max(0, Math.min(23, input.startHour)),
    endHour: Math.max(0, Math.min(23, input.endHour)),
    accountBinding: input.accountBinding ?? existing?.accountBinding,
  }
}

export async function upsertSchedule(input: ReviewScheduleInput): Promise<ReviewSchedule> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readwrite')
  const store = tx.objectStore(SCHEDULES_STORE)
  const existing = input.id ? await requestToPromise(store.get(input.id) as IDBRequest<ReviewSchedule | undefined>) : undefined
  const now = Date.now()
  const definition = normalizedDefinition(input, existing)
  const schedule: ReviewSchedule = {
    id: input.id ?? crypto.randomUUID(),
    ...definition,
    nextRunAt: nextRun(definition.intervalMinutes, now),
    lastRunAt: existing?.lastRunAt,
    createdAt: existing?.createdAt ?? now,
    definitionRevision: (existing?.definitionRevision ?? 0) + 1,
    definitionUpdatedAt: now,
    runtimeUpdatedAt: now,
    updatedAt: now,
  }
  store.put(schedule)
  await transactionDone(tx)
  db.close()
  return schedule
}

export async function listSchedules(): Promise<ReviewSchedule[]> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readonly')
  const schedules = await requestToPromise(tx.objectStore(SCHEDULES_STORE).getAll() as IDBRequest<ReviewSchedule[]>)
  await transactionDone(tx)
  db.close()
  return schedules.sort((a,b)=>a.nextRunAt-b.nextRunAt)
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readwrite')
  tx.objectStore(SCHEDULES_STORE).delete(id)
  await transactionDone(tx)
  db.close()
}

export async function markScheduleRun(id: string, now = Date.now()): Promise<ReviewSchedule | undefined> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readwrite')
  const store = tx.objectStore(SCHEDULES_STORE)
  const current = await requestToPromise(store.get(id) as IDBRequest<ReviewSchedule | undefined>)
  if (!current) { await transactionDone(tx); db.close(); return undefined }
  const updated: ReviewSchedule = {
    ...current,
    lastRunAt: now,
    nextRunAt: nextRun(current.intervalMinutes, now),
    runtimeUpdatedAt: now,
  }
  store.put(updated)
  await transactionDone(tx)
  db.close()
  return updated
}

export function scheduleCanRun(schedule: ReviewSchedule, now = new Date()): boolean {
  return Boolean(schedule.accountBinding) && schedule.enabled && schedule.nextRunAt <= now.getTime() && withinLocalWindow(now, schedule.startHour, schedule.endHour)
}

export async function touchSchedule(id: string, now = Date.now()): Promise<ReviewSchedule | undefined> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readwrite')
  const store = tx.objectStore(SCHEDULES_STORE)
  const current = await requestToPromise(store.get(id) as IDBRequest<ReviewSchedule | undefined>)
  if (!current) { await transactionDone(tx); db.close(); return undefined }
  const updated: ReviewSchedule = {
    ...current,
    definitionRevision: (current.definitionRevision ?? 0) + 1,
    definitionUpdatedAt: now,
    runtimeUpdatedAt: now,
    updatedAt: now,
  }
  store.put(updated)
  await transactionDone(tx)
  db.close()
  return updated
}

export async function applyRemoteSchedule(
  input: ReviewScheduleInput & { id: string },
  revision: number,
  definitionUpdatedAt = Date.now(),
): Promise<ReviewSchedule> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readwrite')
  const store = tx.objectStore(SCHEDULES_STORE)
  const existing = await requestToPromise(store.get(input.id) as IDBRequest<ReviewSchedule | undefined>)
  const now = Date.now()
  const definition = normalizedDefinition(input, existing)
  const schedule: ReviewSchedule = {
    id: input.id,
    ...definition,
    nextRunAt: nextRun(definition.intervalMinutes, now),
    lastRunAt: existing?.lastRunAt,
    createdAt: existing?.createdAt ?? now,
    definitionRevision: Math.max(1, Number(revision) || 1),
    definitionUpdatedAt: Number(definitionUpdatedAt) || now,
    runtimeUpdatedAt: now,
    updatedAt: Number(definitionUpdatedAt) || now,
  }
  store.put(schedule)
  await transactionDone(tx)
  db.close()
  return schedule
}
