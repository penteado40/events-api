const MINUTE_MS = 60_000

export interface RateLimitPolicy {
  /** Hits allowed per window. */
  limit: number
  windowMs: number
}

/** Every rate limit of the API, in one place. */
export const RATE_LIMIT_POLICIES = {
  /** Every login attempt from one IP. */
  'login-ip': { limit: 20, windowMs: 5 * MINUTE_MS },
  /** Wrong passwords for one email, existing or not. */
  'login-email': { limit: 5, windowMs: 15 * MINUTE_MS },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES
