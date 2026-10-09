import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  connectAuthEmulator, createUserWithEmailAndPassword,
  inMemoryPersistence, initializeAuth, signOut, type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore,
  setDoc, type Firestore,
} from 'firebase/firestore'

const projectId = 'demo-autotool'
let a: { app: FirebaseApp; auth: Auth; db: Firestore }
let b: { app: FirebaseApp; auth: Auth; db: Firestore }

function testClient(name: string): { app: FirebaseApp; auth: Auth; db: Firestore } {
  const app = initializeApp({
    apiKey: 'fake-api-key', authDomain: projectId + '.firebaseapp.com',
    projectId, appId: '1:123456789:web:test',
  }, name)
  const auth = initializeAuth(app, { persistence: inMemoryPersistence })
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  return { app, auth, db }
}

beforeAll(async () => {
  a = testClient('pilot-a')
  b = testClient('pilot-b')
  await Promise.all([
    createUserWithEmailAndPassword(a.auth, 'pilot-a@example.com', 'TestingPassword123!'),
    createUserWithEmailAndPassword(b.auth, 'pilot-b@example.com', 'TestingPassword123!'),
  ])
})

afterAll(async () => {
  await Promise.all([deleteApp(a.app), deleteApp(b.app)])
})

describe('Firebase Auth + Firestore actual SDK integration', () => {
  it('creates two separate Auth identities using Email/Password Emulator', () => {
    expect(a.auth.currentUser?.uid).toBeTruthy()
    expect(b.auth.currentUser?.uid).toBeTruthy()
    expect(a.auth.currentUser?.uid).not.toBe(b.auth.currentUser?.uid)
  })

  it('allows own profile CRUD but denies access from a different signed-in Firebase account', async () => {
    const aUid = a.auth.currentUser!.uid
    const record = doc(a.db, 'users', aUid, 'aiProfiles', 'pilot-profile')
    const payload = {
      id: 'pilot-profile',
      name: 'Pilot expert',
      persona: 'Useful, concise',
      promptVersion: 'comment-v2',
      config: { strategy: 'INSIGHT', notes: '' },
      revision: 1,
      updatedAt: Date.now(),
    }
    await setDoc(record, payload)
    expect((await getDoc(record)).data()?.name).toBe('Pilot expert')
    await expect(getDoc(doc(b.db, 'users', aUid, 'aiProfiles', 'pilot-profile'))).rejects.toThrow()
    await expect(setDoc(doc(b.db, 'users', aUid, 'aiProfiles', 'pilot-profile'), {
      ...payload,
      revision: 2,
    })).rejects.toThrow()
    await expect(setDoc(record, { ...payload, revision: 1, name: 'stale' })).rejects.toThrow()
    await setDoc(record, { ...payload, revision: 2, name: 'Updated profile' })
    expect((await getDoc(record)).data()?.name).toBe('Updated profile')
    await deleteDoc(record)
    expect((await getDoc(record)).exists()).toBe(false)
  })

  it('creates and edits the Content Library with real Firebase user credentials', async () => {
    const ref = doc(a.db, 'users', a.auth.currentUser!.uid, 'contentItems', 'pilot-template')
    const payload = {
      id: 'pilot-template', title: 'Review template', body: 'Draft only.',
      kind: 'template', tags: ['review'], revision: 1, updatedAt: Date.now(),
    }
    await setDoc(ref, payload)
    await expect(getDoc(doc(b.db, 'users', a.auth.currentUser!.uid, 'contentItems', 'pilot-template'))).rejects.toThrow()
    await setDoc(ref, { ...payload, title: 'Safe updated template', revision: 2 })
    expect((await getDoc(ref)).data()?.title).toBe('Safe updated template')
    await deleteDoc(ref)
  })

  it('denies Firestore access after signing out', async () => {
    const uid = a.auth.currentUser!.uid
    await signOut(a.auth)
    await expect(getDoc(doc(a.db, 'users', uid, 'aiProfiles', 'pilot-profile'))).rejects.toThrow()
  })
})
