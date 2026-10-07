import { describe, expect, it } from 'vitest'
import { gatewayOriginPattern, isSupportedGatewayUrl, normalizeGatewayUrl } from './gatewayProvider'

describe('gateway helpers', () => {
  it('normalizes trailing slash', () => expect(normalizeGatewayUrl('https://autotool.workers.dev///')).toBe('https://autotool.workers.dev'))
  it('allows Cloudflare Workers and local dev origins', () => {
    expect(isSupportedGatewayUrl('https://autotool.workers.dev')).toBe(true)
    expect(isSupportedGatewayUrl('http://127.0.0.1:8787')).toBe(true)
  })
  it('rejects arbitrary extension hosts', () => {
    expect(isSupportedGatewayUrl('https://example.com')).toBe(false)
    expect(() => gatewayOriginPattern('https://example.com/api')).toThrow(/workers\.dev/i)
  })
  it('builds Chrome origin pattern', () => expect(gatewayOriginPattern('https://autotool.workers.dev/api')).toBe('https://autotool.workers.dev/*'))
})
