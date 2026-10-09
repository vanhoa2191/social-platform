import type { AutomationSafetyState } from '../automation/model'
import { defaultAiGatewaySettings, type AiGatewaySettings } from '../ai/contracts'
import { defaultPilotSettings, normalizePilotSettings, type PilotSettings } from './pilot'

const SETTINGS_KEY = 'autotool.settings'
const SAFETY_KEY = 'autotool.safety'
const ACTION_COUNT_KEY = 'autotool.sessionActionCount'
const AI_SETTINGS_KEY = 'autotool.aiGatewaySettings'
const AI_TOKEN_KEY = 'autotool.aiGatewayToken'
const PILOT_SETTINGS_KEY = 'autotool.pilotSettings'

export interface ExtensionSettings {
  maxActionsPerSession: number
}

export const defaultSettings: ExtensionSettings = {
  maxActionsPerSession: 20,
}

export const defaultSafetyState: AutomationSafetyState = {
  emergencyStop: false,
  updatedAt: 0,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined
  return { maxActionsPerSession: Math.max(1, Math.min(20, Number(stored?.maxActionsPerSession ?? defaultSettings.maxActionsPerSession) || 20)) }
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
  const result = await chrome.storage.local.get([SETTINGS_KEY, SAFETY_KEY, AI_SETTINGS_KEY, PILOT_SETTINGS_KEY])
  const changes: Record<string, unknown> = {}
  if (!result[SETTINGS_KEY]) changes[SETTINGS_KEY] = defaultSettings
  if (!result[SAFETY_KEY]) changes[SAFETY_KEY] = defaultSafetyState
  if (!result[AI_SETTINGS_KEY]) changes[AI_SETTINGS_KEY] = defaultAiGatewaySettings
  if (!result[PILOT_SETTINGS_KEY]) changes[PILOT_SETTINGS_KEY] = defaultPilotSettings
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


export async function getAiGatewaySettings(): Promise<AiGatewaySettings> {
  const result = await chrome.storage.local.get(AI_SETTINGS_KEY)
  return { ...defaultAiGatewaySettings, ...(result[AI_SETTINGS_KEY] as Partial<AiGatewaySettings> | undefined) }
}

export async function saveAiGatewaySettings(settings: AiGatewaySettings): Promise<void> {
  await chrome.storage.local.set({ [AI_SETTINGS_KEY]: settings })
}

export async function getAiGatewayToken(): Promise<string | undefined> {
  const result = await chrome.storage.session.get(AI_TOKEN_KEY)
  const token = result[AI_TOKEN_KEY]
  return typeof token === 'string' && token.trim() ? token.trim() : undefined
}

export async function setAiGatewayToken(token?: string): Promise<void> {
  if (token?.trim()) {
    await chrome.storage.session.set({ [AI_TOKEN_KEY]: token.trim() })
  } else {
    await chrome.storage.session.remove(AI_TOKEN_KEY)
  }
}


export async function getPilotSettings(): Promise<PilotSettings> {
  const result = await chrome.storage.local.get(PILOT_SETTINGS_KEY)
  return normalizePilotSettings(result[PILOT_SETTINGS_KEY] as Partial<PilotSettings> | undefined)
}

export async function savePilotSettings(settings: PilotSettings): Promise<PilotSettings> {
  const current = await getPilotSettings()
  const normalized = normalizePilotSettings(settings)

  if (!current.telemetryOptIn && normalized.telemetryOptIn) {
    normalized.telemetryOptInAt = Date.now()
  } else if (!normalized.telemetryOptIn) {
    normalized.telemetryOptInAt = undefined
  } else if (!normalized.telemetryOptInAt) {
    normalized.telemetryOptInAt = current.telemetryOptInAt ?? Date.now()
  }

  await chrome.storage.local.set({ [PILOT_SETTINGS_KEY]: normalized })
  return normalized
}
