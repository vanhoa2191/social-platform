import { LOCKS_STORE, openRuntimeDb, requestToPromise, transactionDone } from '../extension/runtimeDb'
import type { RuntimeLock } from './types'

export async function acquireLock(key: string, owner: string, leaseMs: number): Promise<boolean> {
  const db = await openRuntimeDb()
  const tx = db.transaction(LOCKS_STORE, 'readwrite')
  const store = tx.objectStore(LOCKS_STORE)
  const current = await requestToPromise(store.get(key) as IDBRequest<RuntimeLock | undefined>)
  const now = Date.now()
  if (current && current.expiresAt > now && current.owner !== owner) { await transactionDone(tx); db.close(); return false }
  store.put({ key, owner, expiresAt: now + leaseMs, updatedAt: now } satisfies RuntimeLock)
  await transactionDone(tx)
  db.close()
  return true
}

export async function renewLock(key: string, owner: string, leaseMs: number): Promise<boolean> {
  const db = await openRuntimeDb()
  const tx = db.transaction(LOCKS_STORE, 'readwrite')
  const store = tx.objectStore(LOCKS_STORE)
  const current = await requestToPromise(store.get(key) as IDBRequest<RuntimeLock | undefined>)
  const now = Date.now()
  const canRenew = Boolean(current && current.owner === owner && current.expiresAt > now)
  if (canRenew) store.put({ key, owner, expiresAt: now + leaseMs, updatedAt: now } satisfies RuntimeLock)
  await transactionDone(tx)
  db.close()
  return canRenew
}

export async function releaseLock(key: string, owner: string): Promise<void> {
  const db = await openRuntimeDb()
  const tx = db.transaction(LOCKS_STORE, 'readwrite')
  const store = tx.objectStore(LOCKS_STORE)
  const current = await requestToPromise(store.get(key) as IDBRequest<RuntimeLock | undefined>)
  if (current?.owner === owner) store.delete(key)
  await transactionDone(tx)
  db.close()
}
