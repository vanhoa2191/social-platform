import type { ReviewCandidate, CandidateState } from './model'
import { CANDIDATES_STORE, openRuntimeDb, requestToPromise, transactionDone } from '../extension/runtimeDb'

export async function upsertCandidate(candidate: ReviewCandidate): Promise<ReviewCandidate> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(CANDIDATES_STORE, 'readwrite')
  transaction.objectStore(CANDIDATES_STORE).put(candidate)
  await transactionDone(transaction)
  db.close()
  return candidate
}

export async function getCandidate(id: string): Promise<ReviewCandidate | undefined> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(CANDIDATES_STORE, 'readonly')
  const candidate = await requestToPromise(transaction.objectStore(CANDIDATES_STORE).get(id) as IDBRequest<ReviewCandidate | undefined>)
  await transactionDone(transaction)
  db.close()
  return candidate
}

export async function listCandidates(states?: CandidateState[]): Promise<ReviewCandidate[]> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(CANDIDATES_STORE, 'readonly')
  const candidates = await requestToPromise(transaction.objectStore(CANDIDATES_STORE).getAll() as IDBRequest<ReviewCandidate[]>)
  await transactionDone(transaction)
  db.close()
  return candidates
    .filter((candidate) => !states || states.includes(candidate.state))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function patchCandidate(id: string, patch: Partial<ReviewCandidate>): Promise<ReviewCandidate | undefined> {
  const current = await getCandidate(id)
  if (!current) return undefined
  return upsertCandidate({ ...current, ...patch, id: current.id, updatedAt: Date.now() })
}

export async function clearCandidates(): Promise<void> {
  const db = await openRuntimeDb()
  const transaction = db.transaction(CANDIDATES_STORE, 'readwrite')
  transaction.objectStore(CANDIDATES_STORE).clear()
  await transactionDone(transaction)
  db.close()
}
