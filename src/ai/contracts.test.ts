import { describe, expect, it } from 'vitest'
import { parseAiGatewayResponse } from './contracts'

describe('parseAiGatewayResponse', () => {
  it('parses a structured gateway response', () => {
    const result = parseAiGatewayResponse({
      draft: { text: 'Một góc nhìn hữu ích.', strategy: 'INSIGHT', confidence: 0.9 },
      provider: 'mock',
      model: 'mock-v1',
      promptVersion: 'comment-v2',
      usage: { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.001 },
    })
    expect(result.draft.text).toBe('Một góc nhìn hữu ích.')
    expect(result.usage.inputTokens).toBe(100)
  })

  it('rejects malformed output', () => {
    expect(() => parseAiGatewayResponse({ draft: { text: '', strategy: 'NOPE' } })).toThrow()
  })
})
