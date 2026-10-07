import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CANDIDATES_STORE,
  DB_NAME,
  EVENTS_STORE,
  JOBS_STORE,
  LOCKS_STORE,
  openRuntimeDb,
  transactionDone,
} from '../extension/runtimeDb'
import { cleanupRuntimeData, retentionPolicy } from './retention'

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

afterEach(deleteDb)

describe('runtime retention', () => {
  it('deletes expired terminal rows but preserves active work', async () => {
    const now = Date.now()
    const db = await openRuntimeDb()
    const tx = db.transaction([JOBS_STORE, CANDIDATES_STORE, EVENTS_STORE, LOCKS_STORE], 'readwrite')

    tx.objectStore(JOBS_STORE).put({
      id:'old-success', type:'SCAN_FEED', state:'SUCCESS', dedupeKey:'old-success',
      resourceKey:'facebook:test', payload:{}, scheduledAt:1, createdAt:1,
      updatedAt: now - retentionPolicy.successJobMs - 1, attempts:1, maxAttempts:3,
    })
    tx.objectStore(JOBS_STORE).put({
      id:'active', type:'SCAN_FEED', state:'PENDING', dedupeKey:'active',
      resourceKey:'facebook:test', payload:{}, scheduledAt:1, createdAt:1,
      updatedAt:1, attempts:0, maxAttempts:3,
    })
    tx.objectStore(CANDIDATES_STORE).put({
      id:'old-review', post:{id:'p',text:'long enough post',sourceUrl:'https://facebook.com',capturedAt:1},
      draft:{text:'draft',strategy:'INSIGHT',confidence:.8,provider:'test',generatedAt:1},
      state:'REJECTED', createdAt:1, updatedAt: now-retentionPolicy.terminalCandidateMs-1,
    })
    tx.objectStore(EVENTS_STORE).put({
      id:'old-event',level:'INFO',category:'SYSTEM',message:'old',
      createdAt: now-retentionPolicy.eventMs-1,
    })
    tx.objectStore(LOCKS_STORE).put({
      key:'expired',owner:'x',expiresAt:now-1,updatedAt:now-100,
    })
    await transactionDone(tx)
    db.close()

    const result = await cleanupRuntimeData(now)
    expect(result).toEqual({
      jobsDeleted:1,
      candidatesDeleted:1,
      eventsDeleted:1,
      locksDeleted:1,
    })

    const verify = await openRuntimeDb()
    expect(await new Promise((resolve,reject)=>{
      const request=verify.transaction(JOBS_STORE).objectStore(JOBS_STORE).get('active')
      request.onsuccess=()=>resolve(request.result)
      request.onerror=()=>reject(request.error)
    })).toBeTruthy()
    verify.close()
  })
})
