import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { getFirebaseAuth, getFirestoreDb } from './client'

export interface CampaignRecord {
  id?: string
  name: string
  type: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  config: Record<string, unknown>
  revision?: number
  updatedAt?: number
}

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

export async function listRemoteCampaigns(): Promise<CampaignRecord[]> {
  const { db, user } = await requireFirebaseContext()
  const snapshot = await getDocs(query(
    collection(db, 'users', user.uid, 'campaigns'),
    orderBy('updatedAt', 'desc'),
  ))

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<CampaignRecord, 'id'>),
  }))
}

export async function upsertRemoteCampaign(record: CampaignRecord): Promise<CampaignRecord> {
  const { db, user } = await requireFirebaseContext()
  const ref = record.id
    ? doc(db, 'users', user.uid, 'campaigns', record.id)
    : doc(collection(db, 'users', user.uid, 'campaigns'))

  const payload: CampaignRecord = {
    ...record,
    id: ref.id,
    revision: Math.max(1, Number(record.revision ?? 0) + 1),
    updatedAt: Date.now(),
  }

  await setDoc(ref, payload, { merge: true })
  return payload
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
