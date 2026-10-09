export function parseDotEnv(source) {
  const result = {}
  for (const row of source.split(/\r?\n/)) {
    const match = row.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const raw = match[2].trim()
    result[match[1]] = raw.replace(/^["']|["']$/g, '')
  }
  return result
}

export function tomlString(source, key) {
  const match = source.match(new RegExp('^\\s*' + key + '\\s*=\\s*"([^"]*)"', 'm'))
  return match?.[1]
}

function isPlaceholder(value) {
  return !value || /placeholder|your-|example|replace|change-me|dummy/i.test(value)
}

export function validateStagingConfig(dotEnvText, wranglerText, { allowMock = false } = {}) {
  const errors = []
  const env = parseDotEnv(dotEnvText)
  const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
  for (const key of required) if (isPlaceholder(env[key])) errors.push('Firebase Web config missing: ' + key)
  if (env.VITE_FIREBASE_USE_EMULATORS?.toLowerCase() !== 'false') {
    errors.push('VITE_FIREBASE_USE_EMULATORS must be explicitly false for staging.')
  }
  if (env.VITE_FIREBASE_ALLOW_REGISTRATION?.toLowerCase() !== 'false') {
    errors.push('VITE_FIREBASE_ALLOW_REGISTRATION must be explicitly false for controlled staging.')
  }
  const trustedGatewayOrigin = env.VITE_AI_GATEWAY_ORIGIN
  try {
    const gatewayUrl = new URL(trustedGatewayOrigin || '')
    if (gatewayUrl.protocol !== 'https:' || !gatewayUrl.hostname.endsWith('.workers.dev')) throw new Error('invalid')
  } catch {
    errors.push('VITE_AI_GATEWAY_ORIGIN must pin one exact HTTPS *.workers.dev origin.')
  }
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  if (projectId && env.VITE_FIREBASE_AUTH_DOMAIN !== projectId + '.firebaseapp.com') {
    errors.push('Firebase AUTH_DOMAIN and PROJECT_ID do not match.')
  }
  if (tomlString(wranglerText, 'GATEWAY_AUTH_MODE') !== 'firebase') {
    errors.push('Gateway must enforce Firebase token auth in staging.')
  }
  if (projectId && tomlString(wranglerText, 'FIREBASE_PROJECT_ID') !== projectId) {
    errors.push('Worker FIREBASE_PROJECT_ID differs from Firebase Web config.')
  }
  const provider = tomlString(wranglerText, 'AI_PROVIDER')
  const globalDailyLimit = Number(tomlString(wranglerText, 'GLOBAL_REQUEST_LIMIT_PER_DAY'))
  if (!provider || (provider === 'mock' && !allowMock)) {
    errors.push('Set a real AI_PROVIDER, or explicitly approve a mock-only staging pilot.')
  }
  if (provider && provider !== 'mock' && (!Number.isInteger(globalDailyLimit) || globalDailyLimit < 1)) {
    errors.push('GLOBAL_REQUEST_LIMIT_PER_DAY must be a positive integer for paid providers.')
  }
  if (provider && provider !== 'mock' && !(tomlString(wranglerText, 'ALLOWED_FIREBASE_UIDS') ?? '').trim()) {
    errors.push('ALLOWED_FIREBASE_UIDS must contain approved pilot users for paid providers.')
  }
  const origins = (tomlString(wranglerText, 'ALLOWED_ORIGINS') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!origins.some((origin) => /^chrome-extension:\/\/[a-p]{32}$/.test(origin))) {
    errors.push('ALLOWED_ORIGINS needs an exact Chrome extension origin (32 a-p letters).')
  }
  if (origins.includes('*') || origins.some((origin) => origin.includes('*'))) {
    errors.push('Wildcard CORS origin is prohibited.')
  }
  if (!/\[\[durable_objects\.bindings\]\]/.test(wranglerText) ||
      !/name\s*=\s*"RATE_LIMITER"/.test(wranglerText) ||
      !/class_name\s*=\s*"UserRateLimiter"/.test(wranglerText) ||
      !/\[\[migrations\]\]/.test(wranglerText) ||
      !/new_sqlite_classes\s*=\s*\["UserRateLimiter"\]/.test(wranglerText)) {
    errors.push('Missing Durable Object quota binding or migration.')
  }
  for (const key of ['AI_API_KEY', 'GATEWAY_TOKEN']) {
    if (new RegExp('^\\s*' + key + '\\s*=', 'm').test(wranglerText)) {
      errors.push(key + ' must be configured as a Worker secret, not committed in TOML.')
    }
  }
  return errors
}
