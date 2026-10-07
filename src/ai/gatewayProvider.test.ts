import { describe, expect, it } from 'vitest'
import { gatewayOriginPattern, normalizeGatewayUrl } from './gatewayProvider'

describe('gateway helpers', () => {
  it('normalizes trailing slash', () => {
    expect(normalizeGatewayUrl('https://gateway.example.com///')).toBe('https://gateway.example.com')
  })

  it('builds Chrome origin permission pattern', () => {
    expect(gatewayOriginPattern('https://gateway.example.com/api')).toBe('https://gateway.example.com/*')
  })
})
