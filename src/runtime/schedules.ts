import { SCHEDULES_STORE, openRuntimeDb, requestToPromise, transactionDone } from '../extension/runtimeDb'
import { withinLocalWindow } from './retry'
import type { ReviewSchedule, ReviewScheduleInput } from './types'

function nextRun(intervalMinutes: number, now = Date.now()): number {
  return now + Math.max(15, intervalMinutes) * 60_000
}

export async function upsertSchedule(input: ReviewScheduleInput): Promise<ReviewSchedule> {
  const db = await openRuntimeDb()
  const tx = db.transaction(SCHEDULES_STORE, 'readwrite')
  const store = tx.objectStore(SCHEDULES_STORE)
  const existing = input.id
    ? await requestToPromise(store.get(input.id) as IDBRequest<ReviewSchedule | undefined>)
    : undefined
  const now = Date.now()
  const schedule: ReviewSchedule = {
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim() || 'Lịch quét Facebook',
    enabled: input.enabled,
    intervalMinutes: Math.max(15, Math.min(1440, input.intervalMinutes)),
    maxPosts: Math.max(1, Math.min(20, input.maxPosts)),
    startHour: Math.max(0, Math.min(23, input.startHour)),
    endHour: Math.max(0, Math.min(23, input.endHour)),
    accountBinding: input.accountBinding ?? existing?.accountBinding,
    nextRunAt: nextRun(input.intervalMinutes, now),
    lastRunAt: existing?.lastRunAt,
    createdAt: existing?.createdAt ?? now,
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
  if (!current) {
    await transactionDone(tx)
    db.close()
    return undefined
  }
  const updated = { ...current, lastRunAt: now, nextRunAt: nextRun(current.intervalMinutes, now), updatedAt: now }
  store.put(updated)
  await transactionDone(tx)
  db.close()
  return updated
}

export function scheduleCanRun(schedule: ReviewSchedule, now = new Date()): boolean {
  return Boolean(schedule.accountBinding) && schedule.enabled && schedule.nextRunAt <= now.getTime() && withinLocalWindow(now, schedule.startHour, schedule.endHour)
}
