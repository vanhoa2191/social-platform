import type { QueueJob, QueueJobInput } from './types'
import { JOBS_STORE, openRuntimeDb, requestToPromise, transactionDone } from './runtimeDb'

export async function enqueueJob(input: QueueJobInput): Promise<QueueJob> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(JOBS_STORE, 'readwrite')
  const store = transaction.objectStore(JOBS_STORE)
  const existing = await requestToPromise(store.index('dedupeKey').get(input.dedupeKey) as IDBRequest<QueueJob | undefined>)
  if (existing) {
    await transactionDone(transaction)
    db.close()
    return existing
  }

  const now = Date.now()
  const job: QueueJob = {
    id: crypto.randomUUID(),
    type: input.type,
    state: 'PENDING',
    dedupeKey: input.dedupeKey,
    resourceKey: input.resourceKey ?? 'facebook:active-tab',
    payload: input.payload ?? {},
    scheduledAt: input.scheduledAt ?? now,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
  }

  store.add(job)
  await transactionDone(transaction)
  db.close()
  return job
}

export async function listJobs(): Promise<QueueJob[]> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(JOBS_STORE, 'readonly')
  const jobs = await requestToPromise(transaction.objectStore(JOBS_STORE).getAll() as IDBRequest<QueueJob[]>)
  await transactionDone(transaction)
  db.close()
  return jobs.sort((a, b) => a.scheduledAt - b.scheduledAt)
}

export async function countJobs(): Promise<number> {
  const jobs = await listJobs()
  return jobs.filter((job) => !['SUCCESS', 'FAILED', 'SKIPPED'].includes(job.state)).length
}

export async function claimDueJobs(owner: string, limit = 3, leaseMs = 2 * 60_000): Promise<QueueJob[]> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(JOBS_STORE, 'readwrite')
  const store = transaction.objectStore(JOBS_STORE)
  const jobs = await requestToPromise(store.getAll() as IDBRequest<QueueJob[]>)
  const now = Date.now()
  const due = jobs
    .filter((job) => {
      const stale = job.state === 'PROCESSING' && (job.leaseExpiresAt ?? 0) <= now
      return (job.state === 'PENDING' || stale) && job.scheduledAt <= now
    })
    .sort((a,b)=>a.scheduledAt-b.scheduledAt)
    .slice(0, Math.max(1, limit))

  const claimed = due.map((job) => ({
    ...job,
    state: 'PROCESSING' as const,
    attempts: job.attempts + 1,
    leaseOwner: owner,
    leaseExpiresAt: now + leaseMs,
    updatedAt: now,
  }))
  for (const job of claimed) store.put(job)
  await transactionDone(transaction)
  db.close()
  return claimed
}

export async function updateJob(id: string, patch: Partial<QueueJob>): Promise<QueueJob | undefined> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(JOBS_STORE, 'readwrite')
  const store = transaction.objectStore(JOBS_STORE)
  const current = await requestToPromise(store.get(id) as IDBRequest<QueueJob | undefined>)
  if (!current) {
    await transactionDone(transaction)
    db.close()
    return undefined
  }
  const next: QueueJob = { ...current, ...patch, id: current.id, updatedAt: Date.now() }
  store.put(next)
  await transactionDone(transaction)
  db.close()
  return next
}

export async function clearQueue(): Promise<void> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(JOBS_STORE, 'readwrite')
  transaction.objectStore(JOBS_STORE).clear()
  await transactionDone(transaction)
  db.close()
}
