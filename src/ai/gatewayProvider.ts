import type { FeedPost } from '../extension/types'
import type { AiDraftProvider } from '../automation/aiProvider'
import type { CommentDraft } from '../automation/model'
import { parseAiGatewayResponse, type AiGatewaySettings } from './contracts'

export function normalizeGatewayUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function isSupportedGatewayUrl(value: string): boolean {
  try {
    const url = new URL(normalizeGatewayUrl(value))
    if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) return true
    return url.protocol === 'https:' && url.hostname.endsWith('.workers.dev')
  } catch { return false }
}

export function gatewayOriginPattern(value: string): string {
  if (!isSupportedGatewayUrl(value)) throw new Error('Gateway production phải dùng HTTPS *.workers.dev; localhost chỉ dành cho dev.')
  const url = new URL(normalizeGatewayUrl(value))
  return `${url.origin}/*`
}

export function createGatewayAiProvider(
  settings: AiGatewaySettings,
  token?: string,
): AiDraftProvider {
  return {
    id: 'gateway',
    async generateComment(post: FeedPost): Promise<CommentDraft> {
      if (!isSupportedGatewayUrl(settings.gatewayUrl)) throw new Error('AI gateway URL không nằm trong host allowlist của extension.')
      const controller = new AbortController()
      const timeout = globalThis.setTimeout(() => controller.abort(), settings.timeoutMs)
      try {
        const response = await fetch(`${normalizeGatewayUrl(settings.gatewayUrl)}/v1/comment`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            post: {
              id: post.id,
              text: post.text,
              author: post.author,
            },
            promptVersion: settings.promptVersion,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text()
          throw new Error(`AI gateway HTTP ${response.status}: ${body.slice(0, 240)}`)
        }

        const parsed = parseAiGatewayResponse(await response.json())
        return {
          text: parsed.draft.text,
          strategy: parsed.draft.strategy,
          confidence: parsed.draft.confidence,
          provider: parsed.provider,
          model: parsed.model,
          promptVersion: parsed.promptVersion,
          usage: parsed.usage,
          generatedAt: Date.now(),
        }
      } finally {
        globalThis.clearTimeout(timeout)
      }
    },
  }
}
