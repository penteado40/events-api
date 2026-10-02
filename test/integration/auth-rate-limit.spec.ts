import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser } from './support/factories.js'

// VERCEL=1 trusts x-forwarded-for, so each test picks its own client IP.
describe('rate limit on login', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ env: { VERCEL: '1', DOCS_ENABLED: 'true' } })
    await createUser({ email: 'ana@example.com', password: 'correct-password' })
  })

  afterAll(() => t.close())

  function login(ip: string, email: string, password: string) {
    return t.http().post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password })
  }

  it('answers 429 RATE_LIMITED with Retry-After past 20 attempts from one IP', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await login('203.0.113.1', `user${i}@example.com`, 'wrong-password')
      expect(res.status).toBe(401)
    }

    const res = await login('203.0.113.1', 'ana@example.com', 'correct-password')

    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: { code: 'RATE_LIMITED', message: expect.any(String) } })
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(300)
  })

  it('keeps other IPs out of that limit', async () => {
    const res = await login('203.0.113.2', 'ana@example.com', 'correct-password')

    expect(res.status).toBe(200)
  })

  it('answers 429 to the right password after 5 wrong ones for the email, from any IP', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await login(`198.51.100.${i}`, 'ana@example.com', 'wrong-password')
      expect(res.status).toBe(401)
    }

    const res = await login('198.51.100.99', 'ana@example.com', 'correct-password')

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(900)
  })

  it('counts the Scalar login (POST /auth/token) in the same IP limit', async () => {
    for (let i = 0; i < 20; i++) {
      await login('203.0.113.3', `user${i}@example.com`, 'wrong-password')
    }

    const res = await t
      .http()
      .post('/api/v1/auth/token')
      .set('X-Forwarded-For', '203.0.113.3')
      .type('form')
      .send({ grant_type: 'password', username: 'someone@example.com', password: 'x' })

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
  })
})
