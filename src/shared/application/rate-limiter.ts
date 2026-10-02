import { AppError } from '../domain/app-error.js'
import type { Clock } from './clock.js'
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from './rate-limit-policies.js'
import type { RateLimitStore } from './rate-limit-store.js'

/** RATE_LIMITED, with how long until the current window ends (the `Retry-After`). */
export class RateLimitedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super('RATE_LIMITED')
  }
}

export interface RateLimiterOptions {
  /** Called when the store fails; the call then goes through (fail open). */
  onStoreError?: (error: unknown) => void
}

/**
 * Fixed-window rate limit over a shared RateLimitStore (ADR-0007). The current
 * window comes from the Clock and is part of the counter's key, so a new
 * window starts from zero. A failing store lets everything through: the limit
 * is an extra defense, and the password or the API token still authorize.
 */
export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly clock: Clock,
    private readonly options: RateLimiterOptions = {},
  ) {}

  /** Counts one hit for `subject` and refuses it past the limit. */
  async consume(policyName: RateLimitPolicyName, subject: string): Promise<void> {
    const window = this.currentWindow(policyName, subject)
    const count = await this.failOpen(() => this.store.increment(window.key, window.ttlMs))
    if (count > window.limit) throw new RateLimitedError(window.retryAfterSeconds)
  }

  /** Refuses `subject` once its hits reach the limit, without counting this one. */
  async check(policyName: RateLimitPolicyName, subject: string): Promise<void> {
    const window = this.currentWindow(policyName, subject)
    const count = await this.failOpen(() => this.store.count(window.key))
    if (count >= window.limit) throw new RateLimitedError(window.retryAfterSeconds)
  }

  /** Counts one hit for `subject` without deciding anything; pair it with `check`. */
  async hit(policyName: RateLimitPolicyName, subject: string): Promise<void> {
    const window = this.currentWindow(policyName, subject)
    await this.failOpen(() => this.store.increment(window.key, window.ttlMs))
  }

  /** The store's answer, or 0 (nothing counted) when it fails. */
  private async failOpen(read: () => Promise<number>): Promise<number> {
    try {
      return await read()
    } catch (error) {
      this.options.onStoreError?.(error)
      return 0
    }
  }

  private currentWindow(policyName: RateLimitPolicyName, subject: string) {
    const { limit, windowMs } = RATE_LIMIT_POLICIES[policyName]
    const now = this.clock.now().getTime()
    const index = Math.floor(now / windowMs)
    const endsAt = (index + 1) * windowMs
    return {
      key: `${policyName}:${subject}:${index}`,
      limit,
      ttlMs: windowMs,
      retryAfterSeconds: Math.ceil((endsAt - now) / 1000),
    }
  }
}
