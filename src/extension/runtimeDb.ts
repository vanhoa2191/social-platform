export const DB_NAME = 'autotool-runtime'
export const DB_VERSION = 2
export const JOBS_STORE = 'jobs'
export const CANDIDATES_STORE = 'candidates'

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
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open runtime database'))
  })
}
