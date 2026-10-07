export interface BackendConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId?: string
  storageBucket?: string
}

function value(env: Record<string, string | undefined>, key: string): string | undefined {
  const result = env[key]?.trim()
  return result || undefined
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

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: value(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    storageBucket: value(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
  }
}

export function backendConfigured(
  env: Record<string, string | undefined> = import.meta.env,
): boolean {
  return Boolean(getBackendConfig(env))
}

export function firebaseRequiredOrigins(config: BackendConfig): string[] {
  return [
    `https://${config.authDomain}`,
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
    'https://www.googleapis.com',
  ]
}
