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
  const store = transaction.objectStore(JOBS_STORE)
  const jobs = await requestToPromise(store.getAll() as IDBRequest<QueueJob[]>)
  await transactionDone(transaction)
  db.close()
  return jobs.sort((a, b) => a.scheduledAt - b.scheduledAt)
}

export async function countJobs(): Promise<number> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(JOBS_STORE, 'readonly')
  const count = await requestToPromise(transaction.objectStore(JOBS_STORE).count())
  await transactionDone(transaction)
  db.close()
  return count
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
