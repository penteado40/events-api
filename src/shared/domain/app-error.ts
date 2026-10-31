/**
 * Stable error codes (ADR-0008). The domain only knows the code; the HTTP status
 * and the default message live in the catalog in `shared/presentation`.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'USER_NOT_INVITED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'USER_ALREADY_ACTIVE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
    this.name = 'AppError'
  }
}
