/**
 * Stable error codes (ADR-0008). The domain only knows the code; the HTTP status
 * and the default message live in the catalog in `shared/presentation`.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'USER_NOT_INVITED'
  | 'USER_DEACTIVATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'USER_ALREADY_ACTIVE'
  | 'ALREADY_A_GROUP_MEMBER'
  | 'SUPER_ADMIN_NOT_A_GROUP_MEMBER'
  | 'LAST_OWNER'
  | 'TEAM_NAME_TAKEN'
  | 'EVENT_PERIOD_INVALID'
  | 'EVENT_ITEM_TIME_WITHOUT_DATE'
  | 'EVENT_ITEM_ORDER_MIXED'
  | 'EVENT_ITEM_ORDER_INCOMPLETE'
  | 'EVENT_NOT_DRAFT'
  | 'EVENT_CANCELLED'
  | 'EVENT_NOT_CANCELLED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
    this.name = 'AppError'
  }
}
