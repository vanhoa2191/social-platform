export interface PilotSettings {
  enabled: boolean
  telemetryOptIn: boolean
  telemetryOptInAt?: number
  maxPostsPerRun: number
  maxActionsPerSession: number
}

export const defaultPilotSettings: PilotSettings = {
  enabled: true,
  telemetryOptIn: false,
  maxPostsPerRun: 5,
  maxActionsPerSession: 10,
}

export function normalizePilotSettings(input?: Partial<PilotSettings>): PilotSettings {
  return {
    enabled: input?.enabled ?? defaultPilotSettings.enabled,
    telemetryOptIn: input?.telemetryOptIn ?? defaultPilotSettings.telemetryOptIn,
    telemetryOptInAt: typeof input?.telemetryOptInAt === 'number' ? input.telemetryOptInAt : undefined,
    maxPostsPerRun: Math.max(1, Math.min(20, Number(input?.maxPostsPerRun ?? defaultPilotSettings.maxPostsPerRun))),
    maxActionsPerSession: Math.max(1, Math.min(50, Number(input?.maxActionsPerSession ?? defaultPilotSettings.maxActionsPerSession))),
  }
}

export function effectivePostLimit(requested: number, pilot: PilotSettings): number {
  const normalized = Math.max(1, Math.min(100, Number(requested) || 1))
  return pilot.enabled ? Math.min(normalized, pilot.maxPostsPerRun) : normalized
}

export function effectiveActionLimit(configured: number, pilot: PilotSettings): number {
  const normalized = Math.max(1, Math.min(200, Number(configured) || 1))
  return pilot.enabled ? Math.min(normalized, pilot.maxActionsPerSession) : normalized
}

export function releaseChannelFromVersionName(versionName?: string): 'beta' | 'stable' | 'dev' {
  const normalized = (versionName ?? '').toLowerCase()
  if (normalized.includes('stable')) return 'stable'
  if (normalized.includes('beta')) return 'beta'
  return 'dev'
}
