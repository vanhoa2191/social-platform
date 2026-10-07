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
    })
  })

  it('stays local-only when config is incomplete', () => {
    expect(backendConfigured({
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_PROJECT_ID: 'autotool-test',
    })).toBe(false)
  })

  it('returns the minimum Firebase network origins required by the extension', () => {
    const config = getBackendConfig(firebaseEnv)!
    expect(firebaseRequiredOrigins(config)).toEqual(expect.arrayContaining([
      'https://autotool-test.firebaseapp.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://firestore.googleapis.com',
    ]))
  })
})
