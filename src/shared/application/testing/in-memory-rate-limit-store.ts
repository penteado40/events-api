import type { Clock } from '../clock.js'
import { RateLimitStore } from '../rate-limit-store.js'

interface Counter {
  count: number
  expiresAt: number
}

/**
 * Counters in this instance's memory: for tests, and for development without
 * Upstash. Useless in serverless, where each instance has its own memory.
 */
export class InMemoryRateLimitStore extends RateLimitStore {
  private readonly counters = new Map<string, Counter>()

  constructor(private readonly clock: Clock) {
    super()
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const now = this.clock.now().getTime()
    const counter = this.live(key, now) ?? { count: 0, expiresAt: now + ttlMs }
    counter.count += 1
    this.counters.set(key, counter)
    return counter.count
  }

  async count(key: string): Promise<number> {
    return this.live(key, this.clock.now().getTime())?.count ?? 0
  }

  private live(key: string, now: number): Counter | undefined {
    const counter = this.counters.get(key)
    if (counter && counter.expiresAt <= now) {
      this.counters.delete(key)
      return undefined
    }
    return counter
  }
}
