import { describe, expect, it } from 'vitest'
import { backendConfigured, firebaseRequiredOrigins, getBackendConfig } from './config'

const firebaseEnv = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'autotool-test.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'autotool-test',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
}

describe('Firebase backend config', () => {
  it('accepts a complete Firebase Web config', () => {
    expect(getBackendConfig(firebaseEnv)).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'autotool-test.firebaseapp.com',
      projectId: 'autotool-test',
      appId: '1:123:web:abc',
      messagingSenderId: undefined,
      storageBucket: undefined,
      useEmulators: false,
      authEmulatorHost: '127.0.0.1:9099',
      firestoreEmulatorHost: '127.0.0.1:8080',
    })
  })

  it('stays local-only when config is incomplete', () => {
    expect(backendConfigured({
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_PROJECT_ID: 'autotool-test',
    })).toBe(false)
  })

  it('returns production Firebase network origins', () => {
    const config = getBackendConfig(firebaseEnv)!
    expect(firebaseRequiredOrigins(config)).toEqual(expect.arrayContaining([
      'https://autotool-test.firebaseapp.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://firestore.googleapis.com',
    ]))
  })

  it('supports local Firebase emulators without production hosts', () => {
    const config = getBackendConfig({
      ...firebaseEnv,
      VITE_FIREBASE_USE_EMULATORS: 'true',
      VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    })!

    expect(config.useEmulators).toBe(true)
    expect(firebaseRequiredOrigins(config)).toEqual([
      'http://127.0.0.1:9099',
      'http://127.0.0.1:8080',
    ])
  })
})
