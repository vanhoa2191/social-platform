export interface BackendConfig {
  url: string
  publishableKey: string
}

export function getBackendConfig(env: Record<string, string | undefined> = import.meta.env): BackendConfig | undefined {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey) return undefined

  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) return undefined
  } catch {
    return undefined
  }

  return { url: url.replace(/\/$/, ''), publishableKey }
}

export function backendConfigured(env: Record<string, string | undefined> = import.meta.env): boolean {
  return Boolean(getBackendConfig(env))
}
