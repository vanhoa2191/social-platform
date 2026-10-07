import { describe, expect, it } from 'vitest'
import {
  defaultPilotSettings,
  effectiveActionLimit,
  effectivePostLimit,
  normalizePilotSettings,
  releaseChannelFromVersionName,
} from './pilot'

describe('pilot safeguards', () => {
  it('defaults to enabled pilot mode with telemetry off', () => {
    expect(defaultPilotSettings.enabled).toBe(true)
    expect(defaultPilotSettings.telemetryOptIn).toBe(false)
  })

  it('caps pilot workload but leaves normal mode configurable', () => {
    expect(effectivePostLimit(20, defaultPilotSettings)).toBe(5)
    expect(effectiveActionLimit(20, defaultPilotSettings)).toBe(10)
    expect(effectivePostLimit(20, { ...defaultPilotSettings, enabled: false })).toBe(20)
  })

  it('normalizes unsafe values', () => {
    expect(normalizePilotSettings({ maxPostsPerRun: 999, maxActionsPerSession: 0 })).toMatchObject({
      maxPostsPerRun: 20,
      maxActionsPerSession: 1,
    })
  })

  it('detects release channel from manifest version name', () => {
    expect(releaseChannelFromVersionName('0.8.0-beta')).toBe('beta')
    expect(releaseChannelFromVersionName('0.8.0-stable')).toBe('stable')
    expect(releaseChannelFromVersionName()).toBe('dev')
  })
})
