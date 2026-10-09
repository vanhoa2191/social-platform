import type { ReviewCandidate } from '../automation/model'
import type { QueueJob } from '../extension/types'
import type { RuntimeEvent, RuntimeLock } from './types'
import {
  CANDIDATES_STORE,
  EVENTS_STORE,
  JOBS_STORE,
  LOCKS_STORE,
  openRuntimeDb,
  requestToPromise,
  transactionDone,
} from '../extension/runtimeDb'

const DAY = 24 * 60 * 60 * 1000

export const retentionPolicy = {
  successJobMs: 14 * DAY,
  terminalJobMs: 30 * DAY,
  candidateMs: 30 * DAY,
  eventMs: 30 * DAY,
  maxEvents: 10_000,
}

export interface RetentionSummary {
  jobsDeleted: number
  candidatesDeleted: number
  eventsDeleted: number
  locksDeleted: number
}

export async function cleanupRuntimeData(now = Date.now()): Promise<RetentionSummary> {
  const db = await openRuntimeDb()
  const tx = db.transaction(
    [JOBS_STORE, CANDIDATES_STORE, EVENTS_STORE, LOCKS_STORE],
    'readwrite',
  )
  const jobsStore = tx.objectStore(JOBS_STORE)
  const candidatesStore = tx.objectStore(CANDIDATES_STORE)
  const eventsStore = tx.objectStore(EVENTS_STORE)
  const locksStore = tx.objectStore(LOCKS_STORE)

  const [jobs, candidates, events, locks] = await Promise.all([
    requestToPromise(jobsStore.getAll() as IDBRequest<QueueJob[]>),
    requestToPromise(candidatesStore.getAll() as IDBRequest<ReviewCandidate[]>),
    requestToPromise(eventsStore.getAll() as IDBRequest<RuntimeEvent[]>),
    requestToPromise(locksStore.getAll() as IDBRequest<RuntimeLock[]>),
  ])

  let jobsDeleted = 0
  for (const job of jobs) {
    const age = now - job.updatedAt
    const shouldDelete =
      (job.state === 'SUCCESS' && age > retentionPolicy.successJobMs)
      || (['FAILED', 'SKIPPED'].includes(job.state) && age > retentionPolicy.terminalJobMs)
    if (shouldDelete) {
      jobsStore.delete(job.id)
      jobsDeleted += 1
    }
  }

  let candidatesDeleted = 0
  for (const candidate of candidates) {
    if (now - candidate.updatedAt > retentionPolicy.candidateMs) {
      candidatesStore.delete(candidate.id)
      candidatesDeleted += 1
    }
  }

  const eventCutoff = now - retentionPolicy.eventMs
  const sortedEvents = [...events].sort((a, b) => b.createdAt - a.createdAt)
  const keepIds = new Set(
    sortedEvents
      .filter((event) => event.createdAt >= eventCutoff)
      .slice(0, retentionPolicy.maxEvents)
      .map((event) => event.id),
  )

  let eventsDeleted = 0
  for (const event of events) {
    if (!keepIds.has(event.id)) {
      eventsStore.delete(event.id)
      eventsDeleted += 1
    }
  }

  let locksDeleted = 0
  for (const lock of locks) {
    if (lock.expiresAt <= now) {
      locksStore.delete(lock.key)
      locksDeleted += 1
    }
  }

  await transactionDone(tx)
  db.close()
  return { jobsDeleted, candidatesDeleted, eventsDeleted, locksDeleted }
}
