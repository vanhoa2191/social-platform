export type AutomationErrorCode =
  | 'EMERGENCY_STOP'
  | 'WRONG_PAGE'
  | 'TAB_NOT_FOUND'
  | 'CONTENT_SCRIPT_UNAVAILABLE'
  | 'POST_NOT_FOUND'
  | 'COMPOSER_NOT_FOUND'
  | 'INVALID_STATE'
  | 'LOCKED'
  | 'UNKNOWN'

export class AutomationError extends Error {
  readonly code: AutomationErrorCode
  readonly retryable: boolean

  constructor(code: AutomationErrorCode, message: string, retryable = false) {
    super(message)
    this.name = 'AutomationError'
    this.code = code
    this.retryable = retryable
  }
}

export function classifyAutomationError(error: unknown): AutomationError {
  if (error instanceof AutomationError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('Không tìm thấy bài')) return new AutomationError('POST_NOT_FOUND', message, true)
  if (message.includes('ô bình luận')) return new AutomationError('COMPOSER_NOT_FOUND', message, true)
  if (message.includes('Content script')) return new AutomationError('CONTENT_SCRIPT_UNAVAILABLE', message, true)
  return new AutomationError('UNKNOWN', message || 'Unknown automation error', false)
}
