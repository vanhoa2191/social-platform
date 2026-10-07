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

export async function getEventWatermark(): Promise<number> {
  return (await getValue<number>(EVENT_WATERMARK_KEY)) ?? 0
}

export async function setEventWatermark(value: number): Promise<void> {
  await setValue(EVENT_WATERMARK_KEY, value)
}

export const supabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    return (await getValue<string>(key)) ?? null
  },
  async setItem(key: string, value: string): Promise<void> {
    await setValue(key, value)
  },
  async removeItem(key: string): Promise<void> {
    if (extensionRuntime()) {
      await chrome.storage.local.remove(key)
      return
    }
    globalThis.localStorage?.removeItem(key)
  },
}
