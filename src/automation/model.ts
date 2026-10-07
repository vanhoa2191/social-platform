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
  provider: 'local-mock'
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
}

export interface AutomationSafetyState {
  emergencyStop: boolean
  updatedAt: number
}
