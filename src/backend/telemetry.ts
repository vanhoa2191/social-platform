import type { RuntimeEvent } from '../runtime/types'

export interface TelemetryEventRow {
  browser_instance_id: string
  local_event_id: string
  event_type: string
  category: RuntimeEvent['category']
  level: RuntimeEvent['level']
  payload: {
    schemaVersion: 1
  }
  occurred_at: string
}

export function toTelemetryEventRow(
  event: RuntimeEvent,
  browserInstanceId: string,
): TelemetryEventRow {
  return {
    browser_instance_id: browserInstanceId,
    local_event_id: event.id,
    event_type: event.category.toLowerCase(),
    category: event.category,
    level: event.level,
    payload: { schemaVersion: 1 },
    occurred_at: new Date(event.createdAt).toISOString(),
  }
}


export function telemetryConsentCutoff(
  watermark: number,
  telemetryOptInAt: number | undefined,
  now = Date.now(),
): number {
  return Math.max(watermark, telemetryOptInAt ?? now)
}
