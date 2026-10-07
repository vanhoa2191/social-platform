import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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

    await assertSucceeds(setDoc(
      doc(userA, 'users/user-a/campaigns/campaign-1'),
      {
        id: 'campaign-1',
        name: 'Pilot campaign',
        type: 'review_assist',
        status: 'draft',
        config: {},
        revision: 1,
        updatedAt: 1,
      },
    ))

    await assertFails(getDoc(doc(userB, 'users/user-a/campaigns/campaign-1')))
    await assertFails(setDoc(
      doc(userB, 'users/user-a/campaigns/campaign-2'),
      {
        id: 'campaign-2',
        name: 'Not allowed',
        type: 'review_assist',
        status: 'draft',
        config: {},
        revision: 1,
        updatedAt: 1,
      },
    ))
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

  it('rejects unknown cloud collections by default', async () => {
    const db = env.authenticatedContext('user-a').firestore()
    await assertFails(setDoc(
      doc(db, 'users/user-a/privateSecrets/secret-1'),
      { value: 'should never be accepted' },
    ))
  })
})
