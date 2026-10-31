import { beforeEach, describe, expect, it } from 'vitest'
import type { RateLimitPolicy } from './rate-limit-policies.js'
import { RateLimitStore } from './rate-limit-store.js'
import { RateLimitedError, RateLimiter } from './rate-limiter.js'
import { FixedClock } from './testing/fixed-clock.js'
import { InMemoryRateLimitStore } from './testing/in-memory-rate-limit-store.js'

const PER_IP: RateLimitPolicy = { name: 'per-ip', limit: 20, windowMs: 5 * 60_000 }
const PER_EMAIL: RateLimitPolicy = { name: 'per-email', limit: 5, windowMs: 15 * 60_000 }
const START = new Date('2026-10-02T12:00:00.000Z')

describe('RateLimiter', () => {
  let clock: FixedClock
  let limiter: RateLimiter

  beforeEach(() => {
    clock = new FixedClock(START)
    limiter = new RateLimiter(new InMemoryRateLimitStore(clock), clock)
  })

  async function consumeTimes(times: number, key: string) {
    for (let i = 0; i < times; i++) await limiter.consume(PER_IP, key)
  }

  describe('consume', () => {
    it('lets every request up to the limit through', async () => {
      await expect(consumeTimes(20, '10.0.0.1')).resolves.toBeUndefined()
    })

    it('refuses the request past the limit with RATE_LIMITED', async () => {
      await consumeTimes(20, '10.0.0.1')

      const refused = limiter.consume(PER_IP, '10.0.0.1')

      await expect(refused).rejects.toBeInstanceOf(RateLimitedError)
      await expect(refused).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    })

    it('tells how long until the window ends, rounded up to whole seconds', async () => {
      clock.set(new Date(START.getTime() + 61_500)) // 61.5 s into a 5-min window
      await consumeTimes(20, '10.0.0.1')

      await expect(limiter.consume(PER_IP, '10.0.0.1')).rejects.toMatchObject({
        retryAfterSeconds: 239,
      })
    })

    it('starts over when the window ends', async () => {
      await consumeTimes(20, '10.0.0.1')
      await expect(limiter.consume(PER_IP, '10.0.0.1')).rejects.toThrow()

      clock.set(new Date(START.getTime() + 5 * 60_000))

      await expect(consumeTimes(20, '10.0.0.1')).resolves.toBeUndefined()
    })

    it('keeps each subject and each policy apart', async () => {
      await consumeTimes(20, '10.0.0.1')

      await expect(limiter.consume(PER_IP, '10.0.0.2')).resolves.toBeUndefined()
      await expect(limiter.consume(PER_EMAIL, '10.0.0.1')).resolves.toBeUndefined()
    })
  })

  describe('check and hit', () => {
    async function hitTimes(times: number, key: string) {
      for (let i = 0; i < times; i++) await limiter.hit(PER_EMAIL, key)
    }

    it('lets check through, without counting, while the hits stay below the limit', async () => {
      await hitTimes(4, 'ana@example.com')

      for (let i = 0; i < 10; i++) {
        await expect(limiter.check(PER_EMAIL, 'ana@example.com')).resolves.toBeUndefined()
      }
    })

    it('refuses check once the hits reach the limit, until the window ends', async () => {
      await hitTimes(5, 'ana@example.com')

      await expect(limiter.check(PER_EMAIL, 'ana@example.com')).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        retryAfterSeconds: 900,
      })

      clock.set(new Date(START.getTime() + 15 * 60_000))
      await expect(limiter.check(PER_EMAIL, 'ana@example.com')).resolves.toBeUndefined()
    })
  })

  describe('when the store fails', () => {
    class FailingStore extends RateLimitStore {
      increment(): Promise<number> {
        return Promise.reject(new Error('Upstash is down'))
      }
      count(): Promise<number> {
        return Promise.reject(new Error('Upstash is down'))
      }
    }

    it('lets every call through and reports the error (fail open)', async () => {
      const errors: unknown[] = []
      const failing = new RateLimiter(new FailingStore(), clock, {
        onStoreError: (error) => errors.push(error),
      })

      await expect(failing.consume(PER_IP, '10.0.0.1')).resolves.toBeUndefined()
      await expect(failing.check(PER_EMAIL, 'ana@example.com')).resolves.toBeUndefined()
      await expect(failing.hit(PER_EMAIL, 'ana@example.com')).resolves.toBeUndefined()
      expect(errors).toEqual([
        new Error('Upstash is down'),
        new Error('Upstash is down'),
        new Error('Upstash is down'),
      ])
    })
  })
})
