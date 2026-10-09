import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DB_NAME } from './runtimeDb'
import { claimDueJobs, enqueueJob, listJobs, renewJobLease, skipPendingJobs } from './queue'

function deleteDb(): Promise<void> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess=()=>resolve()
    request.onerror=()=>reject(request.error)
  })
}
afterEach(deleteDb)

describe('queue leases', () => {
  it('marks pending jobs skipped when Emergency Stop cancels the queue', async () => {
    await enqueueJob({type:'CREATE_REVIEW_CANDIDATES',dedupeKey:'stop-1',resourceKey:'facebook:test'})
    await enqueueJob({type:'SCAN_FEED',dedupeKey:'stop-2',resourceKey:'facebook:test'})
    expect(await skipPendingJobs('Emergency Stop')).toBe(2)
    expect((await listJobs()).map((job)=>job.state)).toEqual(['SKIPPED','SKIPPED'])
  })

  it('renews only the active owner lease', async () => {
    const job=await enqueueJob({type:'CREATE_REVIEW_CANDIDATES',dedupeKey:'lease-test',resourceKey:'facebook:test',scheduledAt:Date.now()-1})
    const [claimed]=await claimDueJobs('worker-a',1,1000)
    expect(claimed.id).toBe(job.id)
    expect(await renewJobLease(job.id,'worker-b',60000)).toBe(false)
    expect(await renewJobLease(job.id,'worker-a',60000)).toBe(true)
  })
})
