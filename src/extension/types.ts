import type { AiGatewaySettings, AiHealthResponse } from '../ai/contracts'
import type { AutomationSafetyState, CandidateState, ReviewCandidate } from '../automation/model'

export type JobState =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'

export type JobType = 'SCAN_FEED' | 'AI_DRAFT' | 'REVIEW'

export interface QueueJob {
  id: string
  type: JobType
  state: JobState
  dedupeKey: string
  payload: Record<string, unknown>
  scheduledAt: number
  createdAt: number
  updatedAt: number
  attempts: number
  maxAttempts: number
  lastError?: string
}

export interface QueueJobInput {
  type: JobType
  dedupeKey: string
  payload?: Record<string, unknown>
  scheduledAt?: number
  maxAttempts?: number
}

export interface FeedPost {
  id: string
  text: string
  author?: string
  sourceUrl: string
  permalink?: string
  capturedAt: number
}

export interface PageContext {
  url: string
  title: string
  isFacebook: boolean
}

export interface RuntimeStatus {
  extensionId: string
  version: string
  activeTab?: {
    id?: number
    title?: string
    url?: string
    supported: boolean
  }
  queuedJobs: number
  reviewCandidates: number
  sessionActions: number
  maxSessionActions: number
  safety: AutomationSafetyState
}

export interface PrepareCommentResult {
  postId: string
  prepared: boolean
  composerText: string
}

export interface AiSettingsView {
  settings: AiGatewaySettings
  hasToken: boolean
}

export type BackgroundRequest =
  | { type: 'PING' }
  | { type: 'GET_RUNTIME_STATUS' }
  | { type: 'SCAN_ACTIVE_TAB'; limit?: number }
  | { type: 'CREATE_REVIEW_CANDIDATES'; limit?: number }
  | { type: 'REVIEW_LIST'; states?: CandidateState[] }
  | { type: 'REVIEW_APPROVE'; candidateId: string }
  | { type: 'REVIEW_REJECT'; candidateId: string }
  | { type: 'REVIEW_PREPARE'; candidateId: string }
  | { type: 'REVIEW_RETRY'; candidateId: string }
  | { type: 'REVIEW_REGENERATE'; candidateId: string }
  | { type: 'REVIEW_UPDATE_DRAFT'; candidateId: string; text: string }
  | { type: 'REVIEW_CLEAR' }
  | { type: 'GET_SAFETY_STATE' }
  | { type: 'SET_EMERGENCY_STOP'; enabled: boolean }
  | { type: 'AI_SETTINGS_GET' }
  | { type: 'AI_SETTINGS_SET'; settings: AiGatewaySettings; token?: string }
  | { type: 'AI_GATEWAY_TEST' }
  | { type: 'QUEUE_LIST' }
  | { type: 'QUEUE_ENQUEUE'; job: QueueJobInput }
  | { type: 'QUEUE_CLEAR' }

export type ContentRequest =
  | { type: 'CONTENT_PING' }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'SCAN_FEED'; limit?: number }
  | { type: 'PREPARE_COMMENT'; postId: string; comment: string }

export type ReviewListResponse = ReviewCandidate[]
export type GatewayHealth = AiHealthResponse

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }
