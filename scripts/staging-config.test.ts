import { describe, expect, it } from 'vitest'
import { parseDotEnv, validateStagingConfig } from './staging-config.mjs'

const firebase = [
  'VITE_FIREBASE_API_KEY=AIzaFakeLocalExampleKey',
  'VITE_FIREBASE_AUTH_DOMAIN=autotool-staging.firebaseapp.com',
  'VITE_FIREBASE_PROJECT_ID=autotool-staging',
  'VITE_FIREBASE_APP_ID=1:123:web:001',
  'VITE_FIREBASE_USE_EMULATORS=false',
].join('\n').replace('AIzaFakeLocalExampleKey', 'AIzaStagingIllustrationKey')

const worker = [
  'name = "autotool-staging"',
  '[vars]',
  'GATEWAY_AUTH_MODE = "firebase"',
  'FIREBASE_PROJECT_ID = "autotool-staging"',
  'ALLOWED_ORIGINS = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"',
  'AI_PROVIDER = "openai"',
  '[[durable_objects.bindings]]',
  'name = "RATE_LIMITER"',
  'class_name = "UserRateLimiter"',
  '[[migrations]]',
  'tag = "v1"',
  'new_sqlite_classes = ["UserRateLimiter"]',
].join('\n')

describe('Staging preflight', () => {
  it('accepts a structurally complete staging configuration', () => {
    expect(validateStagingConfig(firebase, worker)).toEqual([])
  })
  it('rejects emulator builds, mismatched project IDs, wildcard CORS and missing quota', () => {
    const errors = validateStagingConfig(
      firebase.replace('VITE_FIREBASE_USE_EMULATORS=false', 'VITE_FIREBASE_USE_EMULATORS=true'),
      worker.replace('FIREBASE_PROJECT_ID = "autotool-staging"', 'FIREBASE_PROJECT_ID = "other-project"')
        .replace('chrome-extension://abcdefghijklmnopabcdefghijklmnop', '*')
        .replace('class_name = "UserRateLimiter"', 'class_name = "MissingLimiter"'),
    )
    expect(errors.join(' ')).toMatch(/EMULATORS/)
    expect(errors.join(' ')).toMatch(/PROJECT_ID/)
    expect(errors.join(' ')).toMatch(/ALLOWED_ORIGINS/)
    expect(errors.join(' ')).toMatch(/Wildcard/)
    expect(errors.join(' ')).toMatch(/Durable Object/)
  })
  it('disallows mock providers by default and secrets in TOML', () => {
    const errors = validateStagingConfig(firebase, worker.replace('AI_PROVIDER = "openai"', 'AI_PROVIDER = "mock"') + '\nAI_API_KEY = "test"')
    expect(errors.join(' ')).toMatch(/real AI_PROVIDER/)
    expect(errors.join(' ')).toMatch(/AI_API_KEY/)
  })
  it('parses environment assignments without using eval', () => {
    expect(parseDotEnv('FOO="bar"\n# ignored\nexport BAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })
})
