import { EVENTS_STORE, openRuntimeDb, requestToPromise, transactionDone } from '../extension/runtimeDb'
import type { RuntimeEvent, RuntimeEventCategory, RuntimeEventCursor, RuntimeEventLevel } from './types'

export async function logRuntimeEvent(level: RuntimeEventLevel, category: RuntimeEventCategory, message: string, detail?: string): Promise<RuntimeEvent> {
  const event = { id: crypto.randomUUID(), level, category, message, detail, createdAt: Date.now() }
  const db = await openRuntimeDb()
  const tx = db.transaction(EVENTS_STORE, 'readwrite')
  tx.objectStore(EVENTS_STORE).add(event)
  await transactionDone(tx)
  db.close()
  return event
}

export async function listRuntimeEvents(limit = 100): Promise<RuntimeEvent[]> {
  const db = await openRuntimeDb()
  const tx = db.transaction(EVENTS_STORE, 'readonly')
  const events = await requestToPromise(tx.objectStore(EVENTS_STORE).getAll() as IDBRequest<RuntimeEvent[]>)
  await transactionDone(tx)
  db.close()
  return events.sort((a,b)=>b.createdAt-a.createdAt).slice(0, Math.max(1, Math.min(limit, 500)))
}

export async function listRuntimeEventsAfter(cursor?: RuntimeEventCursor, limit = 500): Promise<RuntimeEvent[]> {
  const db = await openRuntimeDb()
  const tx = db.transaction(EVENTS_STORE, 'readonly')
  const index = tx.objectStore(EVENTS_STORE).index('createdAtId')
  const safeLimit = Math.max(1, Math.min(limit, 500))
  const range = cursor ? IDBKeyRange.lowerBound([cursor.createdAt, cursor.id], true) : undefined
  const events: RuntimeEvent[] = []
  await new Promise<void>((resolve, reject) => {
    const request = index.openCursor(range, 'next')
    request.onerror = () => reject(request.error ?? new Error('Unable to read runtime events'))
    request.onsuccess = () => {
      const current = request.result
      if (!current || events.length >= safeLimit) { resolve(); return }
      events.push(current.value as RuntimeEvent)
      current.continue()
    }
  })
  await transactionDone(tx)
  db.close()
  return events
}

export async function clearRuntimeEvents(): Promise<void> {
  const db = await openRuntimeDb()
  const tx = db.transaction(EVENTS_STORE, 'readwrite')
  tx.objectStore(EVENTS_STORE).clear()
  await transactionDone(tx)
  db.close()
}
