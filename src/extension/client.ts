import { gatewayOriginPattern } from '../ai/gatewayProvider'
import type { AiGatewaySettings, AiHealthResponse } from '../ai/contracts'
import type { AutomationSafetyState, CandidateState, ReviewCandidate } from '../automation/model'
import type { ReviewSchedule, ReviewScheduleInput, RuntimeEvent } from '../runtime/types'
import type { AdapterDiagnostic, PlatformContext } from '../platform/types'
import type { AiSettingsView, ExtensionResponse, FeedPost, RuntimeStatus } from './types'

function runtimeAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
}

async function send<T>(message: unknown): Promise<ExtensionResponse<T>> {
  if (!runtimeAvailable()) {
    return { ok: false, error: 'Dashboard đang chạy ở chế độ web preview, chưa phải Chrome Extension.' }
  }
  try {
    return await chrome.runtime.sendMessage(message) as ExtensionResponse<T>
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không kết nối được Extension runtime.' }
  }
}

export function isExtensionRuntime(): boolean {
  return runtimeAvailable()
}

export async function requestGatewayOriginPermission(url: string): Promise<ExtensionResponse<{ granted: boolean }>> {
  if (!runtimeAvailable()) return { ok: false, error: 'Chỉ có thể cấp quyền khi đang chạy Chrome Extension.' }
  try {
    const origin = gatewayOriginPattern(url)
    const already = await chrome.permissions.contains({ origins: [origin] })
    if (already) return { ok: true, data: { granted: true } }
    const granted = await chrome.permissions.request({ origins: [origin] })
    return { ok: true, data: { granted } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Không thể xin quyền truy cập AI gateway.' }
  }
}

export function getRuntimeStatus(): Promise<ExtensionResponse<RuntimeStatus>> {
  return send<RuntimeStatus>({ type: 'GET_RUNTIME_STATUS' })
}

export function getPlatformContext(): Promise<ExtensionResponse<PlatformContext>> {
  return send<PlatformContext>({ type: 'GET_PLATFORM_CONTEXT' })
}

export function getAdapterDiagnostic(): Promise<ExtensionResponse<AdapterDiagnostic>> {
  return send<AdapterDiagnostic>({ type: 'GET_ADAPTER_DIAGNOSTIC' })
}

export function scanActiveFacebookTab(limit = 20, expectedAccountContextKey?: string): Promise<ExtensionResponse<FeedPost[]>> {
  return send<FeedPost[]>({ type: 'SCAN_ACTIVE_TAB', limit, expectedAccountContextKey })
}

export function createReviewCandidates(limit = 10): Promise<ExtensionResponse<ReviewCandidate[]>> {
  return send<ReviewCandidate[]>({ type: 'CREATE_REVIEW_CANDIDATES', limit })
}

export function listReviewCandidates(states?: CandidateState[]): Promise<ExtensionResponse<ReviewCandidate[]>> {
  return send<ReviewCandidate[]>({ type: 'REVIEW_LIST', states })
}

export function approveReviewCandidate(candidateId: string): Promise<ExtensionResponse<ReviewCandidate>> {
  return send<ReviewCandidate>({ type: 'REVIEW_APPROVE', candidateId })
}

export function rejectReviewCandidate(candidateId: string): Promise<ExtensionResponse<ReviewCandidate>> {
  return send<ReviewCandidate>({ type: 'REVIEW_REJECT', candidateId })
}

export function prepareApprovedComment(candidateId: string): Promise<ExtensionResponse<ReviewCandidate>> {
  return send<ReviewCandidate>({ type: 'REVIEW_PREPARE', candidateId })
}

export function retryReviewCandidate(candidateId: string): Promise<ExtensionResponse<ReviewCandidate>> {
  return send<ReviewCandidate>({ type: 'REVIEW_RETRY', candidateId })
}

export function regenerateReviewCandidate(candidateId: string): Promise<ExtensionResponse<ReviewCandidate>> {
  return send<ReviewCandidate>({ type: 'REVIEW_REGENERATE', candidateId })
}

export function updateReviewDraft(candidateId: string, text: string): Promise<ExtensionResponse<ReviewCandidate>> {
  return send<ReviewCandidate>({ type: 'REVIEW_UPDATE_DRAFT', candidateId, text })
}

export function getSafetyState(): Promise<ExtensionResponse<AutomationSafetyState>> {
  return send<AutomationSafetyState>({ type: 'GET_SAFETY_STATE' })
}

export function setEmergencyStop(enabled: boolean): Promise<ExtensionResponse<AutomationSafetyState>> {
  return send<AutomationSafetyState>({ type: 'SET_EMERGENCY_STOP', enabled })
}

export function clearReviewCandidates(): Promise<ExtensionResponse<{ cleared: true }>> {
  return send<{ cleared: true }>({ type: 'REVIEW_CLEAR' })
}

export function getAiSettings(): Promise<ExtensionResponse<AiSettingsView>> {
  return send<AiSettingsView>({ type: 'AI_SETTINGS_GET' })
}

export function saveAiSettings(settings: AiGatewaySettings, token?: string): Promise<ExtensionResponse<AiSettingsView>> {
  return send<AiSettingsView>({ type: 'AI_SETTINGS_SET', settings, token })
}

export function testAiGateway(): Promise<ExtensionResponse<AiHealthResponse>> {
  return send<AiHealthResponse>({ type: 'AI_GATEWAY_TEST' })
}


export function listSchedules(): Promise<ExtensionResponse<ReviewSchedule[]>> {
  return send<ReviewSchedule[]>({ type: 'SCHEDULE_LIST' })
}

export function saveSchedule(schedule: ReviewScheduleInput): Promise<ExtensionResponse<ReviewSchedule>> {
  return send<ReviewSchedule>({ type: 'SCHEDULE_UPSERT', schedule })
}

export function deleteSchedule(scheduleId: string): Promise<ExtensionResponse<{ deleted: true }>> {
  return send<{ deleted: true }>({ type: 'SCHEDULE_DELETE', scheduleId })
}

export function runScheduleNow(scheduleId: string): Promise<ExtensionResponse<{ queued: true }>> {
  return send<{ queued: true }>({ type: 'SCHEDULE_RUN_NOW', scheduleId })
}

export function runQueueNow(): Promise<ExtensionResponse<{ processed: true }>> {
  return send<{ processed: true }>({ type: 'QUEUE_RUN_NOW' })
}

export function listRuntimeEvents(limit = 100): Promise<ExtensionResponse<RuntimeEvent[]>> {
  return send<RuntimeEvent[]>({ type: 'EVENT_LIST', limit })
}

export function clearRuntimeEvents(): Promise<ExtensionResponse<{ cleared: true }>> {
  return send<{ cleared: true }>({ type: 'EVENT_CLEAR' })
}
