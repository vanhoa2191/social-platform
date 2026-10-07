import type { RuntimeEvent, RuntimeEventCursor } from '../runtime/types'

export interface TelemetryEventRecord {
  browserInstanceId: string
  localEventId: string
  eventType: string
  category: RuntimeEvent['category']
  level: RuntimeEvent['level']
  payload: { schemaVersion: 1 }
  occurredAt: string
}

export function toTelemetryEventRecord(event: RuntimeEvent, browserInstanceId: string): TelemetryEventRecord {
  return {
    browserInstanceId,
    localEventId: event.id,
    eventType: event.category.toLowerCase(),
    category: event.category,
    level: event.level,
    payload: { schemaVersion: 1 },
    occurredAt: new Date(event.createdAt).toISOString(),
  }
}

export function telemetryConsentCutoff(
  watermark: number,
  telemetryOptInAt: number | undefined,
  now = Date.now(),
): number {
  return Math.max(watermark, telemetryOptInAt ?? now)
}

export function telemetryStartCursor(
  watermark: RuntimeEventCursor | undefined,
  telemetryOptInAt: number | undefined,
  now = Date.now(),
): RuntimeEventCursor {
  const consentCutoff = telemetryOptInAt ?? now
  if (watermark && watermark.createdAt >= consentCutoff) return watermark
  return { createdAt: consentCutoff, id: '\uffff' }
}

export function eventCursor(event: RuntimeEvent): RuntimeEventCursor {
  return { createdAt: event.createdAt, id: event.id }
}
