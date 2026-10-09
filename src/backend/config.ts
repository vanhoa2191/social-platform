export interface BackendConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId?: string
  storageBucket?: string
  allowAccountRegistration: boolean
  useEmulators: boolean
  authEmulatorHost: string
  firestoreEmulatorHost: string
}

function value(env: Record<string, string | undefined>, key: string): string | undefined {
  const result = env[key]?.trim()
  return result || undefined
}

function booleanValue(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase())
}

function validHostPort(value: string): boolean {
  return /^(localhost|127\.0\.0\.1|[a-z0-9.-]+):\d{2,5}$/i.test(value)
}

export function getBackendConfig(
  env: Record<string, string | undefined> = import.meta.env,
): BackendConfig | undefined {
  const apiKey = value(env, 'VITE_FIREBASE_API_KEY')
  const authDomain = value(env, 'VITE_FIREBASE_AUTH_DOMAIN')
  const projectId = value(env, 'VITE_FIREBASE_PROJECT_ID')
  const appId = value(env, 'VITE_FIREBASE_APP_ID')

  if (!apiKey || !authDomain || !projectId || !appId) return undefined
  if (!/^[a-z0-9.-]+$/i.test(authDomain)) return undefined
  if (!/^[a-z0-9-]+$/i.test(projectId)) return undefined

  const authEmulatorHost = value(env, 'VITE_FIREBASE_AUTH_EMULATOR_HOST') ?? '127.0.0.1:9099'
  const firestoreEmulatorHost = value(env, 'VITE_FIRESTORE_EMULATOR_HOST') ?? '127.0.0.1:8080'
  if (!validHostPort(authEmulatorHost) || !validHostPort(firestoreEmulatorHost)) return undefined

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: value(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: value(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
    allowAccountRegistration: booleanValue(value(env, 'VITE_FIREBASE_ALLOW_REGISTRATION')),
    useEmulators: booleanValue(value(env, 'VITE_FIREBASE_USE_EMULATORS')),
    authEmulatorHost,
    firestoreEmulatorHost,
  }
}

export function backendConfigured(
  env: Record<string, string | undefined> = import.meta.env,
): boolean {
  return Boolean(getBackendConfig(env))
}

export function firebaseRequiredOrigins(config: BackendConfig): string[] {
  if (config.useEmulators) {
    return [
      `http://${config.authEmulatorHost}`,
      `http://${config.firestoreEmulatorHost}`,
    ]
  }

  return [
    `https://${config.authDomain}`,
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
    'https://www.googleapis.com',
  ]
}
