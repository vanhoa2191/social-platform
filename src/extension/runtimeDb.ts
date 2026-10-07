export const DB_NAME = 'autotool-runtime'
export const DB_VERSION = 4
export const JOBS_STORE = 'jobs'
export const CANDIDATES_STORE = 'candidates'
export const LOCKS_STORE = 'locks'
export const SCHEDULES_STORE = 'schedules'
export const EVENTS_STORE = 'events'
export const META_STORE = 'meta'

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function openRuntimeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(JOBS_STORE)) {
        const jobs = database.createObjectStore(JOBS_STORE, { keyPath: 'id' })
        jobs.createIndex('dedupeKey', 'dedupeKey', { unique: true })
        jobs.createIndex('scheduledAt', 'scheduledAt')
        jobs.createIndex('state', 'state')
      }
      if (!database.objectStoreNames.contains(CANDIDATES_STORE)) {
        const candidates = database.createObjectStore(CANDIDATES_STORE, { keyPath: 'id' })
        candidates.createIndex('postId', 'post.id', { unique: true })
        candidates.createIndex('state', 'state')
        candidates.createIndex('updatedAt', 'updatedAt')
      }
      if (!database.objectStoreNames.contains(LOCKS_STORE)) {
        database.createObjectStore(LOCKS_STORE, { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains(SCHEDULES_STORE)) {
        const schedules = database.createObjectStore(SCHEDULES_STORE, { keyPath: 'id' })
        schedules.createIndex('nextRunAt', 'nextRunAt')
        schedules.createIndex('enabled', 'enabled')
      }
      if (!database.objectStoreNames.contains(EVENTS_STORE)) {
        const events = database.createObjectStore(EVENTS_STORE, { keyPath: 'id' })
        events.createIndex('createdAt', 'createdAt')
        events.createIndex('level', 'level')
      }
      const meta = database.objectStoreNames.contains(META_STORE)
        ? request.transaction!.objectStore(META_STORE)
        : database.createObjectStore(META_STORE, { keyPath: 'key' })
      meta.put({
        key: 'schema',
        version: DB_VERSION,
        upgradedAt: Date.now(),
      })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open runtime database'))
  })
}


export interface RuntimeDbInfo {
  name: string
  version: number
  stores: string[]
  schemaVersion?: number
  upgradedAt?: number
}

export async function getRuntimeDbInfo(): Promise<RuntimeDbInfo> {
  const db = await openRuntimeDb()
  let schemaVersion: number | undefined
  let upgradedAt: number | undefined

  if (db.objectStoreNames.contains(META_STORE)) {
    const tx = db.transaction(META_STORE, 'readonly')
    const meta = await requestToPromise(
      tx.objectStore(META_STORE).get('schema') as IDBRequest<
        { key: 'schema'; version: number; upgradedAt: number } | undefined
      >,
    )
    await transactionDone(tx)
    schemaVersion = meta?.version
    upgradedAt = meta?.upgradedAt
  }

  const info: RuntimeDbInfo = {
    name: db.name,
    version: db.version,
    stores: Array.from(db.objectStoreNames),
    schemaVersion,
    upgradedAt,
  }
  db.close()
  return info
}
