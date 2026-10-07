import type { FeedPost } from '../extension/types'

export type CandidateState =
  | 'DRAFTING'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'PREPARING'
  | 'PREPARED'
  | 'REJECTED'
  | 'FAILED'

export interface CommentDraft {
  text: string
  strategy: 'INSIGHT' | 'QUESTION' | 'CLARIFICATION'
  confidence: number
  provider: string
  model?: string
  promptVersion?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    estimatedCostUsd: number
  }
  edited?: boolean
  generatedAt: number
}

export interface ReviewCandidate {
  id: string
  post: FeedPost
  draft: CommentDraft
  state: CandidateState
  createdAt: number
  updatedAt: number
  error?: string
  approvedDraft?: CommentDraft
  approvedAt?: number
}

export interface AutomationSafetyState {
  emergencyStop: boolean
  updatedAt: number
}
