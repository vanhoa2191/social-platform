import type { RuntimeEventCursor } from '../runtime/types'

const DEVICE_KEY = 'autotool.backend.deviceKey'
const EVENT_WATERMARK_KEY = 'autotool.backend.eventWatermark'

function extensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

async function getValue<T>(key: string): Promise<T | undefined> {
  if (extensionRuntime()) {
    const result = await chrome.storage.local.get(key)
    return result[key] as T | undefined
  }
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? JSON.parse(raw) as T : undefined
  } catch {
    return undefined
  }
}

async function setValue(key: string, value: unknown): Promise<void> {
  if (extensionRuntime()) {
    await chrome.storage.local.set({ [key]: value })
    return
  }
  globalThis.localStorage?.setItem(key, JSON.stringify(value))
}

export async function getOrCreateDeviceKey(): Promise<string> {
  const current = await getValue<string>(DEVICE_KEY)
  if (current) return current
  const created = crypto.randomUUID()
  await setValue(DEVICE_KEY, created)
  return created
}

export async function getEventWatermark(): Promise<RuntimeEventCursor | undefined> {
  const current = await getValue<RuntimeEventCursor | number>(EVENT_WATERMARK_KEY)
  if (typeof current === 'number') return { createdAt: current, id: '\uffff' }
  if (current && typeof current.createdAt === 'number' && typeof current.id === 'string') return current
  return undefined
}

export async function setEventWatermark(value: RuntimeEventCursor): Promise<void> {
  await setValue(EVENT_WATERMARK_KEY, value)
}
