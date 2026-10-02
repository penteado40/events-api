import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'
import { RateLimitStore } from '../application/rate-limit-store.js'

/** A rate-limit check must not hold a request: past this, the RateLimiter fails open. */
const TIMEOUT_MS = 1_000

export interface UpstashRateLimitStoreOptions {
  url: string
  token: string
  /** One per environment sharing the database (`events-api:production`...). */
  prefix: string
}

/**
 * Counters in Upstash Redis, over HTTP (ADR-0007). Keys are hashed so no IP or
 * email is stored there in clear.
 */
export class UpstashRateLimitStore extends RateLimitStore {
  private readonly redis: Redis

  constructor(private readonly options: UpstashRateLimitStoreOptions) {
    super()
    this.redis = new Redis({
      url: options.url,
      token: options.token,
      retry: { retries: 1 },
      signal: () => AbortSignal.timeout(TIMEOUT_MS),
    })
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const stored = this.storedKey(key)
    // One HTTP round trip; NX sets the expiry only on the counter's first hit.
    const [count] = await this.redis
      .pipeline()
      .incr(stored)
      .pexpire(stored, ttlMs, 'NX')
      .exec<[number, 0 | 1]>()
    return count
  }

  async count(key: string): Promise<number> {
    return (await this.redis.get<number>(this.storedKey(key))) ?? 0
  }

  private storedKey(key: string): string {
    return `${this.options.prefix}:rl:${createHash('sha256').update(key).digest('hex')}`
  }
}
