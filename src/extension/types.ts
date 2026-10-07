import type { AiGatewaySettings, AiHealthResponse } from '../ai/contracts'
import type { AutomationSafetyState, CandidateState, ReviewCandidate } from '../automation/model'
import type { AccountContext, AdapterDiagnostic, PlatformContext, PlatformSurface } from '../platform/types'
import type { ReviewSchedule, ReviewScheduleInput, RuntimeEvent } from '../runtime/types'
import type { PilotSettings } from './pilot'

export type JobState =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'

export type JobType = 'SCAN_FEED' | 'CREATE_REVIEW_CANDIDATES' | 'AI_DRAFT' | 'REVIEW'

export interface QueueJob {
  id: string
  type: JobType
  state: JobState
  dedupeKey: string
  resourceKey: string
  payload: Record<string, unknown>
  scheduledAt: number
  createdAt: number
  updatedAt: number
  attempts: number
  maxAttempts: number
  lastError?: string
  leaseOwner?: string
  leaseExpiresAt?: number
}

export interface QueueJobInput {
  type: JobType
  dedupeKey: string
  resourceKey?: string
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
  surface?: PlatformSurface
  accountContextKey?: string
  accountLabel?: string
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
  platformContext?: PlatformContext
  adapterDiagnostic?: AdapterDiagnostic
  queuedJobs: number
  reviewCandidates: number
  enabledSchedules: number
  recentErrors: number
  runtimeDbVersion: number
  runtimeDbSchemaVersion?: number
  releaseChannel: 'beta' | 'stable' | 'dev'
  pilot: PilotSettings
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
  | { type: 'GET_PLATFORM_CONTEXT' }
  | { type: 'GET_ADAPTER_DIAGNOSTIC' }
  | { type: 'SCAN_ACTIVE_TAB'; limit?: number; expectedAccountContextKey?: string }
  | { type: 'CREATE_REVIEW_CANDIDATES'; limit?: number; expectedAccountContextKey?: string }
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
  | { type: 'PILOT_SETTINGS_GET' }
  | { type: 'PILOT_SETTINGS_SET'; settings: PilotSettings }
  | { type: 'QUEUE_LIST' }
  | { type: 'QUEUE_ENQUEUE'; job: QueueJobInput }
  | { type: 'QUEUE_RUN_NOW' }
  | { type: 'QUEUE_CLEAR' }
  | { type: 'SCHEDULE_LIST' }
  | { type: 'SCHEDULE_UPSERT'; schedule: ReviewScheduleInput }
  | { type: 'SCHEDULE_DELETE'; scheduleId: string }
  | { type: 'SCHEDULE_RUN_NOW'; scheduleId: string }
  | { type: 'SCHEDULE_TOUCH'; scheduleId: string }
  | { type: 'SCHEDULE_APPLY_REMOTE'; schedule: ReviewScheduleInput & { id: string }; revision: number }
  | { type: 'EVENT_LIST'; limit?: number }
  | { type: 'EVENT_CLEAR' }

export type ContentRequest =
  | { type: 'CONTENT_PING' }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'GET_PLATFORM_CONTEXT' }
  | { type: 'GET_ADAPTER_DIAGNOSTIC' }
  | { type: 'SCAN_FEED'; limit?: number }
  | { type: 'PREPARE_COMMENT'; postId: string; comment: string }

export type ReviewListResponse = ReviewCandidate[]
export type GatewayHealth = AiHealthResponse
export type ScheduleListResponse = ReviewSchedule[]
export type RuntimeEventListResponse = RuntimeEvent[]
export type PlatformContextResponse = PlatformContext
export type AdapterDiagnosticResponse = AdapterDiagnostic
export type AccountContextResponse = AccountContext

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }
