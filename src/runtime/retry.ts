export function computeBackoffMs(attempt: number, baseMs = 60_000, maxMs = 30 * 60_000): number {
  const safeAttempt = Math.max(1, attempt)
  return Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1))
}

export function withinLocalWindow(now: Date, startHour: number, endHour: number): boolean {
  const hour = now.getHours()
  if (startHour === endHour) return true
  if (startHour < endHour) return hour >= startHour && hour < endHour
  return hour >= startHour || hour < endHour
}
