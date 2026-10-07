import { describe, expect, it } from 'vitest'
import { telemetryConsentCutoff, toTelemetryEventRecord } from './telemetry'
import type { RuntimeEvent } from '../runtime/types'

describe('telemetry privacy', () => {
  it('does not upload runtime message or detail text', () => {
    const event: RuntimeEvent = {
      id: 'event-1',
      level: 'ERROR',
      category: 'ADAPTER',
      message: 'Private schedule name and page content',
      detail: 'Potentially sensitive diagnostic text',
      createdAt: Date.UTC(2026, 9, 7, 12, 0, 0),
    }

    const row = toTelemetryEventRecord(event, 'browser-1')
    const serialized = JSON.stringify(row)

    expect(serialized).not.toContain(event.message)
    expect(serialized).not.toContain(event.detail!)
    expect(row.payload).toEqual({ schemaVersion: 1 })
    expect(row.category).toBe('ADAPTER')
  })

  it('never selects events from before the current consent window', () => {
    expect(telemetryConsentCutoff(100, 500, 900)).toBe(500)
    expect(telemetryConsentCutoff(700, 500, 900)).toBe(700)
    expect(telemetryConsentCutoff(100, undefined, 900)).toBe(900)
  })
})
