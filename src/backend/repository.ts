import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirestoreDb } from './client'

export interface AiProfileRecord {
  id?: string
  name: string
  persona?: string
  promptVersion: string
  config: Record<string, unknown>
  revision?: number
  updatedAt?: number
}

async function requireFirebaseContext() {
  const [auth, db] = await Promise.all([getFirebaseAuth(), Promise.resolve(getFirestoreDb())])
  if (!auth || !db) throw new Error('Firebase backend chưa được cấu hình.')
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('Hãy đăng nhập Firebase trước.')
  return { db, user }
}

export async function listRemoteAiProfiles(): Promise<AiProfileRecord[]> {
  const { db, user } = await requireFirebaseContext()
  const snapshot = await getDocs(query(
    collection(db, 'users', user.uid, 'aiProfiles'),
    orderBy('updatedAt', 'desc'),
  ))

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<AiProfileRecord, 'id'>),
  }))
}

export async function upsertRemoteAiProfile(record: AiProfileRecord): Promise<AiProfileRecord> {
  const { db, user } = await requireFirebaseContext()
  const ref = record.id
    ? doc(db, 'users', user.uid, 'aiProfiles', record.id)
    : doc(collection(db, 'users', user.uid, 'aiProfiles'))

  const payload: AiProfileRecord = {
    ...record,
    id: ref.id,
    revision: Math.max(1, Number(record.revision ?? 0) + 1),
    updatedAt: Date.now(),
  }

  await setDoc(ref, payload, { merge: true })
  return payload
}

export async function deleteRemoteAiProfile(id: string): Promise<void> {
  const { db, user } = await requireFirebaseContext()
  await deleteDoc(doc(db, 'users', user.uid, 'aiProfiles', id))
}

export interface ContentItemRecord {
  id?: string
  title: string
  body: string
  kind: 'prompt' | 'template' | 'note'
  tags: string[]
  revision?: number
  updatedAt?: number
}

export async function listRemoteContentItems(): Promise<ContentItemRecord[]> {
  const { db, user } = await requireFirebaseContext()
  const snapshot = await getDocs(query(collection(db, 'users', user.uid, 'contentItems'), orderBy('updatedAt', 'desc')))
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ContentItemRecord, 'id'>) }))
}

export async function upsertRemoteContentItem(record: ContentItemRecord): Promise<ContentItemRecord> {
  const { db, user } = await requireFirebaseContext()
  const ref = record.id ? doc(db, 'users', user.uid, 'contentItems', record.id) : doc(collection(db, 'users', user.uid, 'contentItems'))
  const payload: ContentItemRecord = {
    id: ref.id,
    title: record.title.trim().slice(0, 200),
    body: record.body.trim().slice(0, 10000),
    kind: record.kind,
    tags: record.tags.slice(0, 20),
    revision: Math.max(1, Number(record.revision ?? 0) + 1),
    updatedAt: Date.now(),
  }
  await setDoc(ref, payload)
  return payload
}

export async function deleteRemoteContentItem(id: string): Promise<void> {
  const { db, user } = await requireFirebaseContext()
  await deleteDoc(doc(db, 'users', user.uid, 'contentItems', id))
}
