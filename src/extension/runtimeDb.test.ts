import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CANDIDATES_STORE,
  DB_NAME,
  DB_VERSION,
  EVENTS_STORE,
  JOBS_STORE,
  LOCKS_STORE,
  META_STORE,
  SCHEDULES_STORE,
  getRuntimeDbInfo,
  openRuntimeDb,
} from './runtimeDb'

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB delete blocked'))
  })
}

async function createLegacyV3(): Promise<void> {
  await deleteDb()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3)
    request.onupgradeneeded = () => {
      const db = request.result
      const jobs = db.createObjectStore(JOBS_STORE, { keyPath: 'id' })
      jobs.createIndex('dedupeKey', 'dedupeKey', { unique: true })
      jobs.createIndex('scheduledAt', 'scheduledAt')
      jobs.createIndex('state', 'state')
      const candidates = db.createObjectStore(CANDIDATES_STORE, { keyPath: 'id' })
      candidates.createIndex('postId', 'post.id', { unique: true })
      candidates.createIndex('state', 'state')
      candidates.createIndex('updatedAt', 'updatedAt')
      db.createObjectStore(LOCKS_STORE, { keyPath: 'key' })
      const schedules = db.createObjectStore(SCHEDULES_STORE, { keyPath: 'id' })
      schedules.createIndex('nextRunAt', 'nextRunAt')
      schedules.createIndex('enabled', 'enabled')
      const events = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' })
      events.createIndex('createdAt', 'createdAt')
      events.createIndex('level', 'level')
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(JOBS_STORE, 'readwrite')
      tx.objectStore(JOBS_STORE).put({
        id: 'legacy-job',
        type: 'SCAN_FEED',
        state: 'PENDING',
        dedupeKey: 'legacy',
        resourceKey: 'facebook:test',
        payload: {},
        scheduledAt: 1,
        createdAt: 1,
        updatedAt: 1,
        attempts: 0,
        maxAttempts: 3,
      })
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}

afterEach(async () => {
  await deleteDb()
})

describe('runtime database migration', () => {
  it('creates the full v4 schema on a new install', async () => {
    const db = await openRuntimeDb()
    expect(db.version).toBe(DB_VERSION)
    expect(Array.from(db.objectStoreNames)).toEqual(expect.arrayContaining([
      JOBS_STORE,
      CANDIDATES_STORE,
      LOCKS_STORE,
      SCHEDULES_STORE,
      EVENTS_STORE,
      META_STORE,
    ]))
    db.close()

    const info = await getRuntimeDbInfo()
    expect(info.schemaVersion).toBe(DB_VERSION)
    expect(info.stores).toContain(META_STORE)
  })

  it('upgrades a legacy v3 database without deleting existing stores', async () => {
    await createLegacyV3()

    const db = await openRuntimeDb()
    expect(db.version).toBe(DB_VERSION)
    expect(Array.from(db.objectStoreNames)).toEqual(expect.arrayContaining([
      JOBS_STORE,
      CANDIDATES_STORE,
      LOCKS_STORE,
      SCHEDULES_STORE,
      EVENTS_STORE,
      META_STORE,
    ]))

    const tx = db.transaction(JOBS_STORE, 'readonly')
    const legacyJob = await new Promise<unknown>((resolve, reject) => {
      const request = tx.objectStore(JOBS_STORE).get('legacy-job')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect(legacyJob).toMatchObject({ id: 'legacy-job', dedupeKey: 'legacy' })
    db.close()

    const info = await getRuntimeDbInfo()
    expect(info.schemaVersion).toBe(DB_VERSION)
  })
})
