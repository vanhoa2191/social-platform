import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import type { Auth } from 'firebase/auth'
import { getBackendConfig } from './config'

let firestore: Firestore | undefined
let authPromise: Promise<Auth | undefined> | undefined

function extensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
}

export function getFirebaseApp(): FirebaseApp | undefined {
  const config = getBackendConfig()
  if (!config) return undefined

  return getApps().length
    ? getApp()
    : initializeApp(config)
}

export function getFirestoreDb(): Firestore | undefined {
  const app = getFirebaseApp()
  if (!app) return undefined
  firestore ??= getFirestore(app)
  return firestore
}

export async function getFirebaseAuth(): Promise<Auth | undefined> {
  const app = getFirebaseApp()
  if (!app) return undefined

  authPromise ??= (async () => {
    if (extensionRuntime()) {
      const { getAuth } = await import('firebase/auth/web-extension')
      return getAuth(app)
    }

    const { getAuth } = await import('firebase/auth')
    return getAuth(app)
  })()

  return authPromise
}
