import type { RuntimeEventCursor } from '../runtime/types'

const DEVICE_KEY = 'autotool.backend.deviceKey'
const EVENT_WATERMARK_KEY = 'autotool.backend.eventWatermark.v2'
const LOCAL_OWNER_KEY = 'autotool.backend.localDataOwnerUid'

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

export function assertLocalDataOwnership(boundUid: string | undefined, currentUid: string): void {
  if (!currentUid) throw new Error('Firebase user ID không hợp lệ.')
  if (boundUid && boundUid !== currentUid) {
    throw new Error(
      'Dữ liệu workflow local thuộc một tài khoản Firebase khác. '
      + 'Không thể đồng bộ sang tài khoản hiện tại để tránh lộ dữ liệu. '
      + 'Hãy dùng Chrome profile riêng cho mỗi tài khoản.',
    )
  }
}

export async function claimLocalDataOwner(userUid: string): Promise<void> {
  const boundUid = await getValue<string>(LOCAL_OWNER_KEY)
  assertLocalDataOwnership(boundUid, userUid)
  if (!boundUid) {
    await setValue(LOCAL_OWNER_KEY, userUid)
    assertLocalDataOwnership(await getValue<string>(LOCAL_OWNER_KEY), userUid)
  }
}

export async function getEventWatermark(userUid: string): Promise<RuntimeEventCursor | undefined> {
  if (!userUid) return undefined
  const current = await getValue<RuntimeEventCursor>(`${EVENT_WATERMARK_KEY}:${userUid}`)
  if (current && typeof current.createdAt === 'number' && typeof current.id === 'string') return current
  return undefined
}

export async function setEventWatermark(userUid: string, value: RuntimeEventCursor): Promise<void> {
  if (!userUid) throw new Error('Firebase user ID không hợp lệ.')
  await setValue(`${EVENT_WATERMARK_KEY}:${userUid}`, value)
}
