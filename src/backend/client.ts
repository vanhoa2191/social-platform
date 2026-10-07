import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import type { Auth } from 'firebase/auth'
import { getBackendConfig } from './config'

let firestore: Firestore | undefined
let firestoreEmulatorConnected = false
let authPromise: Promise<Auth | undefined> | undefined
let authEmulatorConnected = false

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
  const config = getBackendConfig()
  if (!app || !config) return undefined

  firestore ??= getFirestore(app)

  if (config.useEmulators && !firestoreEmulatorConnected) {
    const [host, portText] = config.firestoreEmulatorHost.split(':')
    connectFirestoreEmulator(firestore, host, Number(portText))
    firestoreEmulatorConnected = true
  }

  return firestore
}

export async function getFirebaseAuth(): Promise<Auth | undefined> {
  const app = getFirebaseApp()
  if (!app) return undefined

  authPromise ??= (async () => {
    const config = getBackendConfig()
    if (!config) return undefined

    if (extensionRuntime()) {
      const { connectAuthEmulator, getAuth } = await import('firebase/auth/web-extension')
      const auth = getAuth(app)
      if (config.useEmulators && !authEmulatorConnected) {
        connectAuthEmulator(auth, `http://${config.authEmulatorHost}`, { disableWarnings: true })
        authEmulatorConnected = true
      }
      return auth
    }

    const { connectAuthEmulator, getAuth } = await import('firebase/auth')
    const auth = getAuth(app)
    if (config.useEmulators && !authEmulatorConnected) {
      connectAuthEmulator(auth, `http://${config.authEmulatorHost}`, { disableWarnings: true })
      authEmulatorConnected = true
    }
    return auth
  })()

  return authPromise
}
