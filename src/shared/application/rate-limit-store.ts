/**
 * Counters shared by every instance (ADR-0007). Deliberately primitive: the
 * algorithm lives in the RateLimiter, so tests exercise the same logic as
 * production.
 */
export abstract class RateLimitStore {
  /** Adds one to the counter of `key` and returns the new count. A new counter expires after `ttlMs`. */
  abstract increment(key: string, ttlMs: number): Promise<number>
  /** The current count of `key`; 0 when it does not exist or has expired. */
  abstract count(key: string): Promise<number>
}
