import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  const rules = await readFile(resolve('firestore.rules'), 'utf8')
  env = await initializeTestEnvironment({
    projectId: 'demo-autotool',
    firestore: { rules },
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('Firestore Security Rules', () => {
  it('allows an authenticated user to write their own browser instance', async () => {
    const db = env.authenticatedContext('user-a').firestore()
    await assertSucceeds(setDoc(
      doc(db, 'users/user-a/browserInstances/device-1'),
      {
        id: 'device-1',
        deviceKey: 'device-1',
        name: 'Chrome Extension',
        extensionVersion: '0.10.0',
        lastSeenAt: '2026-10-07T00:00:00.000Z',
        metadata: { runtime: 'extension' },
      },
    ))
  })

  it('denies cross-user reads and writes', async () => {
    const userA = env.authenticatedContext('user-a').firestore()
    const userB = env.authenticatedContext('user-b').firestore()

    const data = {
      id: 'profile-1',
      name: 'Pilot AI profile',
      persona: 'Concise',
      promptVersion: 'comment-v2',
      config: { strategy: 'QUESTION', notes: '' },
      revision: 1,
      updatedAt: 1,
    }
    await assertSucceeds(setDoc(doc(userA, 'users/user-a/aiProfiles/profile-1'), data))
    await assertFails(getDoc(doc(userB, 'users/user-a/aiProfiles/profile-1')))
    await assertFails(setDoc(doc(userB, 'users/user-a/aiProfiles/profile-1'), { ...data, revision: 2 }))
  })

  it('denies unauthenticated access', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users/user-a/schedules/schedule-1')))
  })

  it('enforces stable schedule document identity', async () => {
    const db = env.authenticatedContext('user-a').firestore()

    await assertSucceeds(setDoc(
      doc(db, 'users/user-a/schedules/schedule-1'),
      {
        id: 'schedule-1',
        localScheduleId: 'schedule-1',
        browserInstanceId: 'device-1',
        name: 'Morning review',
        enabled: true,
        intervalMinutes: 60,
        maxPosts: 5,
        startHour: 8,
        endHour: 12,
        accountContextKey: null,
        accountLabel: null,
        revision: 10,
        definitionUpdatedAt: 10,
        lastSyncedAt: '2026-10-07T00:00:00.000Z',
      },
    ))

    await assertFails(setDoc(
      doc(db, 'users/user-a/schedules/schedule-2'),
      {
        id: 'schedule-2',
        localScheduleId: 'different-id',
        browserInstanceId: 'device-1',
        name: 'Bad identity',
        enabled: true,
        intervalMinutes: 60,
        maxPosts: 5,
        startHour: 8,
        endHour: 12,
        accountContextKey: null,
        accountLabel: null,
        revision: 10,
        definitionUpdatedAt: 10,
        lastSyncedAt: '2026-10-07T00:00:00.000Z',
      },
    ))
  })

  it('rejects telemetry payloads that try to include content text', async () => {
    const db = env.authenticatedContext('user-a').firestore()

    await assertSucceeds(setDoc(
      doc(db, 'users/user-a/analyticsEvents/event-1'),
      {
        browserInstanceId: 'device-1',
        localEventId: 'event-1',
        eventType: 'adapter',
        category: 'ADAPTER',
        level: 'ERROR',
        payload: { schemaVersion: 1 },
        occurredAt: '2026-10-07T00:00:00.000Z',
      },
    ))

    await assertFails(setDoc(
      doc(db, 'users/user-a/analyticsEvents/event-2'),
      {
        browserInstanceId: 'device-1',
        localEventId: 'event-2',
        eventType: 'adapter',
        category: 'ADAPTER',
        level: 'ERROR',
        payload: {
          schemaVersion: 1,
          message: 'Sensitive post content',
        },
        occurredAt: '2026-10-07T00:00:00.000Z',
      },
    ))
  })

  it('rejects deprecated campaigns and unknown cloud collections by default', async () => {
    const db = env.authenticatedContext('user-a').firestore()
    await assertFails(setDoc(doc(db, 'users/user-a/campaigns/deprecated-1'), { id: 'deprecated-1', name: 'Unsafe legacy campaign' }))
    await assertFails(setDoc(
      doc(db, 'users/user-a/privateSecrets/secret-1'),
      { value: 'should never be accepted' },
    ))
  })
  it('enforces schedule ranges and monotonic revisions', async () => {
    const db = env.authenticatedContext('user-a').firestore()
    const ref = doc(db, 'users/user-a/schedules/schedule-ranges')
    const valid = {
      id: 'schedule-ranges', localScheduleId: 'schedule-ranges',
      browserInstanceId: 'device-1', name: 'Review',
      enabled: true, intervalMinutes: 60, maxPosts: 5,
      startHour: 8, endHour: 12, accountContextKey: null,
      accountLabel: null, revision: 10, definitionUpdatedAt: 10,
      lastSyncedAt: '2026-10-09T00:00:00.000Z',
    }

    await assertSucceeds(setDoc(ref, valid))
    await assertFails(setDoc(ref, { ...valid, revision: 11, maxPosts: 21 }))
    await assertFails(setDoc(ref, { ...valid, revision: 11, intervalMinutes: 14 }))
    await assertFails(setDoc(ref, { ...valid, revision: 11, startHour: 24 }))
    await assertFails(setDoc(ref, { ...valid, revision: 11, endHour: -1 }))
    await assertFails(setDoc(ref, { ...valid, revision: 11, name: 'x'.repeat(201) }))
    await assertFails(setDoc(ref, { ...valid, revision: 10, name: 'Stale overwrite' }))
    await assertFails(setDoc(ref, { ...valid, revision: 9, name: 'Rollback' }))
    await assertSucceeds(setDoc(ref, { ...valid, revision: 11, name: 'New revision' }))
  })

  it('enforces owner-only AI Profile CRUD with valid prompt versions and increasing revisions', async () => {
    const owner = env.authenticatedContext('user-a').firestore()
    const other = env.authenticatedContext('user-b').firestore()
    const ref = doc(owner, 'users/user-a/aiProfiles/profile-security')
    const payload = {
      id: 'profile-security', name: 'Expert', persona: 'Helpful',
      promptVersion: 'comment-v2', config: { strategy: 'INSIGHT', notes: '' },
      revision: 1, updatedAt: 1,
    }
    await assertSucceeds(setDoc(ref, payload))
    await assertFails(getDoc(doc(other, 'users/user-a/aiProfiles/profile-security')))
    await assertFails(setDoc(doc(other, 'users/user-a/aiProfiles/profile-security'), { ...payload, revision: 2 }))
    await assertFails(setDoc(ref, { ...payload, revision: 1, name: 'Stale' }))
    await assertFails(setDoc(ref, { ...payload, revision: 2, promptVersion: 'not-reviewed-v3' }))
    await assertFails(setDoc(ref, { ...payload, revision: 2, config: { secretToken: 'should-not-store' } }))
    await assertSucceeds(setDoc(ref, { ...payload, revision: 2, name: 'Edited expert' }))
    await assertFails(deleteDoc(doc(other, 'users/user-a/aiProfiles/profile-security')))
    await assertSucceeds(deleteDoc(ref))
  })

  it('enforces owner-only Content Library CRUD with kind and size validation', async () => {
    const owner = env.authenticatedContext('user-a').firestore()
    const other = env.authenticatedContext('user-b').firestore()
    const ref = doc(owner, 'users/user-a/contentItems/content-security')
    const payload = {
      id: 'content-security', title: 'Prompt', kind: 'prompt',
      body: 'Draft a useful answer only.', tags: ['review'], revision: 1, updatedAt: 1,
    }
    await assertSucceeds(setDoc(ref, payload))
    await assertFails(getDoc(doc(other, 'users/user-a/contentItems/content-security')))
    await assertFails(setDoc(ref, { ...payload, revision: 2, kind: 'autopost' }))
    await assertFails(setDoc(ref, { ...payload, revision: 2, tags: Array.from({ length: 21 }, () => 'x') }))
    await assertFails(setDoc(ref, { ...payload, revision: 2, body: 'x'.repeat(10001) }))
    await assertFails(setDoc(ref, { ...payload, revision: 1, title: 'Stale' }))
    await assertSucceeds(setDoc(ref, { ...payload, revision: 2, title: 'Revised prompt' }))
    await assertFails(deleteDoc(doc(other, 'users/user-a/contentItems/content-security')))
    await assertSucceeds(deleteDoc(ref))
  })

})
