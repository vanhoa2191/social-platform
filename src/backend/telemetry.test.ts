import { describe, expect, it } from 'vitest'
import { eventCursor, telemetryConsentCutoff, telemetryStartCursor, toTelemetryEventRecord } from './telemetry'
import type { RuntimeEvent } from '../runtime/types'

describe('telemetry privacy', () => {
  it('does not upload runtime message or detail text', () => {
    const event: RuntimeEvent = {
      id:'event-1', level:'ERROR', category:'ADAPTER',
      message:'Private schedule name and page content', detail:'Sensitive detail', createdAt:100,
    }
    const row=toTelemetryEventRecord(event,'browser-1')
    const serialized=JSON.stringify(row)
    expect(serialized).not.toContain(event.message)
    expect(serialized).not.toContain(event.detail!)
    expect(row.payload).toEqual({schemaVersion:1})
  })

  it('never selects events from before consent', () => {
    expect(telemetryConsentCutoff(100,500,900)).toBe(500)
    expect(telemetryConsentCutoff(700,500,900)).toBe(700)
  })

  it('uses tuple cursor so paged telemetry does not skip backlog', () => {
    expect(telemetryStartCursor(undefined,500,900)).toEqual({createdAt:500,id:'\uffff'})
    expect(telemetryStartCursor({createdAt:700,id:'event-7'},500,900)).toEqual({createdAt:700,id:'event-7'})
    expect(eventCursor({id:'event-8',level:'INFO',category:'SYSTEM',message:'ok',createdAt:701}))
      .toEqual({createdAt:701,id:'event-8'})
  })
})
