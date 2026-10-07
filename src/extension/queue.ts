import type { QueueJob, QueueJobInput } from './types'

const DB_NAME = 'autotool-runtime'
const STORE_NAME = 'jobs'
const DB_VERSION = 1

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('dedupeKey', 'dedupeKey', { unique: true })
        store.createIndex('scheduledAt', 'scheduledAt')
        store.createIndex('state', 'state')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open queue database'))
  })
}

export async function enqueueJob(input: QueueJobInput): Promise<QueueJob> {
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
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
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  const jobs = await requestToPromise(store.getAll() as IDBRequest<QueueJob[]>)
  await transactionDone(transaction)
  db.close()
  return jobs.sort((a, b) => a.scheduledAt - b.scheduledAt)
}

export async function countJobs(): Promise<number> {
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, 'readonly')
  const count = await requestToPromise(transaction.objectStore(STORE_NAME).count())
  await transactionDone(transaction)
  db.close()
  return count
}

export async function updateJob(id: string, patch: Partial<QueueJob>): Promise<QueueJob | undefined> {
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
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
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).clear()
  await transactionDone(transaction)
  db.close()
}
