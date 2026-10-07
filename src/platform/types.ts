import type { FeedPost, PrepareCommentResult } from '../extension/types'

export type PlatformSurface = 'FEED' | 'GROUP' | 'PAGE' | 'POST' | 'UNKNOWN'
export type AdapterHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'
export type ContextConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AccountContext {
  platform: 'facebook'
  key: string
  label: string
  profileUrl?: string
  confidence: ContextConfidence
  verified: boolean
  evidence: string[]
}

export interface PlatformContext {
  platform: 'facebook'
  url: string
  title: string
  surface: PlatformSurface
  account?: AccountContext
}

export interface AdapterDiagnostic {
  adapterId: string
  health: AdapterHealth
  surface: PlatformSurface
  articleCount: number
  composerCount: number
  accountEvidenceCount: number
  warnings: string[]
  checkedAt: number
}

export interface PlatformAdapter {
  readonly id: string
  canHandle(url: string): boolean
  getContext(): PlatformContext
  diagnose(): AdapterDiagnostic
  scan(limit?: number): FeedPost[]
  prepareComment(postId: string, comment: string): Promise<PrepareCommentResult>
}
