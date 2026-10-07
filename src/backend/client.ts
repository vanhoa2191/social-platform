import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getBackendConfig } from './config'
import { supabaseAuthStorage } from './storage'

let singleton: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient | undefined {
  const config = getBackendConfig()
  if (!config) return undefined
  if (singleton) return singleton

  singleton = createClient(config.url, config.publishableKey, {
    auth: {
      storage: supabaseAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return singleton
}
