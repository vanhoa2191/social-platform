import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DB_NAME } from './runtimeDb'
import { claimDueJobs, enqueueJob, renewJobLease } from './queue'

function deleteDb(): Promise<void> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess=()=>resolve()
    request.onerror=()=>reject(request.error)
  })
}
afterEach(deleteDb)

describe('queue leases', () => {
  it('renews only the active owner lease', async () => {
    const job=await enqueueJob({type:'CREATE_REVIEW_CANDIDATES',dedupeKey:'lease-test',resourceKey:'facebook:test',scheduledAt:Date.now()-1})
    const [claimed]=await claimDueJobs('worker-a',1,1000)
    expect(claimed.id).toBe(job.id)
    expect(await renewJobLease(job.id,'worker-b',60000)).toBe(false)
    expect(await renewJobLease(job.id,'worker-a',60000)).toBe(true)
  })
})
