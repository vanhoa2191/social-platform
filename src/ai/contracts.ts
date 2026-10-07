import type { CommentDraft } from '../automation/model'
import type { FeedPost } from '../extension/types'

export type AiMode = 'local' | 'gateway'
export type PromptVersion = 'comment-v1' | 'comment-v2'

export interface AiGatewaySettings {
  mode: AiMode
  gatewayUrl: string
  promptVersion: PromptVersion
  timeoutMs: number
}

export interface AiGatewayRequest {
  post: Pick<FeedPost, 'id' | 'text' | 'author'>
  promptVersion: PromptVersion
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export interface AiGatewayResponse {
  draft: {
    text: string
    strategy: CommentDraft['strategy']
    confidence: number
  }
  provider: string
  model: string
  promptVersion: PromptVersion
  usage: AiUsage
}

export interface AiHealthResponse {
  ok: true
  provider: string
  model: string
  version: string
}

export const defaultAiGatewaySettings: AiGatewaySettings = {
  mode: 'local',
  gatewayUrl: 'http://127.0.0.1:8787',
  promptVersion: 'comment-v2',
  timeoutMs: 20_000,
}

function isStrategy(value: unknown): value is CommentDraft['strategy'] {
  return value === 'INSIGHT' || value === 'QUESTION' || value === 'CLARIFICATION'
}

export function parseAiGatewayResponse(value: unknown): AiGatewayResponse {
  if (!value || typeof value !== 'object') throw new Error('AI gateway trả dữ liệu không hợp lệ.')
  const root = value as Record<string, unknown>
  const draft = root.draft as Record<string, unknown> | undefined
  const usage = root.usage as Record<string, unknown> | undefined

  if (!draft || typeof draft.text !== 'string' || draft.text.trim().length < 2 || draft.text.trim().length > 1200) {
    throw new Error('AI gateway thiếu draft.text.')
  }
  if (!isStrategy(draft.strategy)) throw new Error('AI gateway trả strategy không hợp lệ.')
  const confidence = Number(draft.confidence)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('AI gateway trả confidence không hợp lệ.')
  }

  const promptVersion = root.promptVersion
  if (promptVersion !== 'comment-v1' && promptVersion !== 'comment-v2') {
    throw new Error('AI gateway trả promptVersion không hợp lệ.')
  }

  return {
    draft: {
      text: draft.text.trim(),
      strategy: draft.strategy,
      confidence,
    },
    provider: typeof root.provider === 'string' ? root.provider : 'unknown',
    model: typeof root.model === 'string' ? root.model : 'unknown',
    promptVersion,
    usage: {
      inputTokens: Math.max(0, Number(usage?.inputTokens ?? 0) || 0),
      outputTokens: Math.max(0, Number(usage?.outputTokens ?? 0) || 0),
      estimatedCostUsd: Math.max(0, Number(usage?.estimatedCostUsd ?? 0) || 0),
    },
  }
}
