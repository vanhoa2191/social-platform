import type { AutomationSafetyState } from '../automation/model'

const SETTINGS_KEY = 'autotool.settings'
const SAFETY_KEY = 'autotool.safety'
const ACTION_COUNT_KEY = 'autotool.sessionActionCount'

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

export const defaultSafetyState: AutomationSafetyState = {
  emergencyStop: false,
  updatedAt: 0,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return { ...defaultSettings, ...(result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined) }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

export async function getSafetyState(): Promise<AutomationSafetyState> {
  const result = await chrome.storage.local.get(SAFETY_KEY)
  return { ...defaultSafetyState, ...(result[SAFETY_KEY] as Partial<AutomationSafetyState> | undefined) }
}

export async function setEmergencyStop(emergencyStop: boolean): Promise<AutomationSafetyState> {
  const state: AutomationSafetyState = { emergencyStop, updatedAt: Date.now() }
  await chrome.storage.local.set({ [SAFETY_KEY]: state })
  return state
}

export async function ensureDefaultSettings(): Promise<void> {
  const result = await chrome.storage.local.get([SETTINGS_KEY, SAFETY_KEY])
  const changes: Record<string, unknown> = {}
  if (!result[SETTINGS_KEY]) changes[SETTINGS_KEY] = defaultSettings
  if (!result[SAFETY_KEY]) changes[SAFETY_KEY] = defaultSafetyState
  if (Object.keys(changes).length) await chrome.storage.local.set(changes)
}


export async function getSessionActionCount(): Promise<number> {
  const result = await chrome.storage.session.get(ACTION_COUNT_KEY)
  return Number(result[ACTION_COUNT_KEY] ?? 0)
}

export async function incrementSessionActionCount(): Promise<number> {
  const next = (await getSessionActionCount()) + 1
  await chrome.storage.session.set({ [ACTION_COUNT_KEY]: next })
  return next
}

export async function resetSessionActionCount(): Promise<void> {
  await chrome.storage.session.set({ [ACTION_COUNT_KEY]: 0 })
}
