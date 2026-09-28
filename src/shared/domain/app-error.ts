/**
 * Stable error codes (ADR-0008). The domain only knows the code; the HTTP status
 * and the default message live in the catalog in `shared/presentation`.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'WEAK_PASSWORD'
  | 'INVALID_CURRENT_PASSWORD'
  | 'EMAIL_ALREADY_IN_USE'
  | 'USER_ALREADY_ACTIVE'
  | 'USER_PENDING'
  | 'ACTIVATION_LINK_INVALID'
  | 'ACTIVATION_LINK_USED'
  | 'ACTIVATION_LINK_EXPIRED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
    this.name = 'AppError'
  }
}
