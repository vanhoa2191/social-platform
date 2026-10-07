import { describe, expect, it } from 'vitest'
import { backendConfigured, getBackendConfig } from './config'

describe('backend config', () => {
  it('accepts a valid Supabase client config', () => {
    expect(getBackendConfig({
      VITE_SUPABASE_URL: 'https://abc.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })).toEqual({
      url: 'https://abc.supabase.co',
      publishableKey: 'sb_publishable_test',
    })
  })

  it('stays local-only when config is incomplete', () => {
    expect(backendConfigured({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toBe(false)
  })
})
