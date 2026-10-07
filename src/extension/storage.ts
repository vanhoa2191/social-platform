const SETTINGS_KEY = 'autotool.settings'

export interface ExtensionSettings {
  reviewBeforeAction: boolean
  maxActionsPerSession: number
  delayMinSeconds: number
  delayMaxSeconds: number
}

export const defaultSettings: ExtensionSettings = {
  reviewBeforeAction: true,
  maxActionsPerSession: 20,
  delayMinSeconds: 30,
  delayMaxSeconds: 90,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...defaultSettings, ...(result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined) }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

export async function ensureDefaultSettings(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  if (!result[SETTINGS_KEY]) {
    await saveSettings(defaultSettings)
  }
}
