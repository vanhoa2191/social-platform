import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DB_NAME } from '../extension/runtimeDb'
import { acquireLock, renewLock } from './locks'

function deleteDb(): Promise<void> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess=()=>resolve()
    request.onerror=()=>reject(request.error)
  })
}
afterEach(deleteDb)

describe('runtime lock leases', () => {
  it('renews only a live lock owned by caller', async () => {
    expect(await acquireLock('facebook:test','job-a',60000)).toBe(true)
    expect(await renewLock('facebook:test','job-b',60000)).toBe(false)
    expect(await renewLock('facebook:test','job-a',60000)).toBe(true)
  })
})
