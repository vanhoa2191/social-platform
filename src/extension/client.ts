import type { AutomationSafetyState, CandidateState, ReviewCandidate } from '../automation/model'
import type { ExtensionResponse, FeedPost, RuntimeStatus } from './types'

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

export function getRuntimeStatus(): Promise<ExtensionResponse<RuntimeStatus>> {
  return send<RuntimeStatus>({ type: 'GET_RUNTIME_STATUS' })
}

export function scanActiveFacebookTab(limit = 20): Promise<ExtensionResponse<FeedPost[]>> {
  return send<FeedPost[]>({ type: 'SCAN_ACTIVE_TAB', limit })
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

export function getSafetyState(): Promise<ExtensionResponse<AutomationSafetyState>> {
  return send<AutomationSafetyState>({ type: 'GET_SAFETY_STATE' })
}

export function setEmergencyStop(enabled: boolean): Promise<ExtensionResponse<AutomationSafetyState>> {
  return send<AutomationSafetyState>({ type: 'SET_EMERGENCY_STOP', enabled })
}

export function clearReviewCandidates(): Promise<ExtensionResponse<{ cleared: true }>> {
  return send<{ cleared: true }>({ type: 'REVIEW_CLEAR' })
}
