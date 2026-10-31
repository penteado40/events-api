export interface RateLimitPolicy {
  /** Part of the counter's key: unique among the policies. */
  name: string
  /** Hits allowed per window. */
  limit: number
  windowMs: number
}

/**
 * Every rate limit of the API, in one place. Empty since the own login left
 * (ADR-0020); a public route that needs a limit adds its policy here.
 */
export const RATE_LIMIT_POLICIES = {} as const satisfies Record<string, RateLimitPolicy>
