export interface RateLimitPolicy {
  /** Part of the counter's key: unique among the policies. */
  name: string
  /** Hits allowed per window. */
  limit: number
  windowMs: number
}

/**
 * Every rate limit of the API, in one place: a route that needs a limit adds
 * its policy here and passes it to `@RateLimit`.
 */
export const RATE_LIMIT_POLICIES = {} as const satisfies Record<string, RateLimitPolicy>
