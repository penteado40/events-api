import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FakeAuthVerifier } from '../../src/modules/identity/application/testing/fake-auth-verifier.js'
import { UserRepository } from '../../src/modules/identity/domain/user.repository.js'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser, sessionTokenFor } from './support/factories.js'

const lostConnection = () =>
  Promise.reject(new Error('connection to db-internal.example:5432 lost'))
const brokenUsers = { findByClerkId: lostConnection, findByEmail: lostConnection }
const anaToken = FakeAuthVerifier.tokenFor({ externalId: 'user_ana', email: 'ana@example.com' })

function withBrokenUserRepository(env: Record<string, string>) {
  return createTestApp({
    env,
    override: (builder) => builder.overrideProvider(UserRepository).useValue(brokenUsers),
  })
}

describe('errors and security headers', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  it('answers an unknown route with 404 NOT_FOUND', async () => {
    const res = await t.http().get('/api/v1/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } })
  })

  it('answers an oversized body with its real 413 status, not a 500', async () => {
    const res = await t
      .http()
      .post('/api/v1/users')
      .send({ name: 'a'.repeat(200_000), email: 'x@example.com' })

    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } })
  })

  it('sends the security headers on success and on error responses', async () => {
    const error = await t.http().get('/api/v1/me')
    const user = await createUser({ email: 'headers@example.com' })
    const success = await t.http().get('/api/v1/me').auth(sessionTokenFor(user), { type: 'bearer' })
    expect(success.status).toBe(200)
    const notFound = await t.http().get('/api/v1/does-not-exist')

    for (const res of [error, success, notFound]) {
      expect(res.headers['content-security-policy']).toContain("default-src 'none'")
      expect(res.headers['x-content-type-options']).toBe('nosniff')
      expect(res.headers['strict-transport-security']).toBeDefined()
      expect(res.headers['x-frame-options']).toBeDefined()
      expect(res.headers['x-powered-by']).toBeUndefined()
    }
  })

  it('does not leak the internal message of an unexpected error in production', async () => {
    const prod = await withBrokenUserRepository({
      NODE_ENV: 'production',
      // Required in production; the test app keeps the counters in memory anyway.
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
      CLERK_SECRET_KEY: 'sk_test_unused',
      ACTIVATION_REDIRECT_URL: 'eventsexpo://activate',
      EMAIL_FROM_ADDRESS: 'noreply@mail.example.com',
      PLATFORM_NAME: 'Programação',
      RESEND_API_KEY: 're_unused',
    })
    try {
      const res = await prod.http().get('/api/v1/me').auth(anaToken, { type: 'bearer' })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' },
      })
      expect(JSON.stringify(res.body)).not.toContain('db-internal')
    } finally {
      await prod.close()
    }
  })

  it('shows the internal message outside production, to ease debugging', async () => {
    const dev = await withBrokenUserRepository({ NODE_ENV: 'development' })
    try {
      const res = await dev.http().get('/api/v1/me').auth(anaToken, { type: 'bearer' })

      expect(res.status).toBe(500)
      expect(res.body.error.code).toBe('INTERNAL_ERROR')
      expect(res.body.error.message).toContain('db-internal')
    } finally {
      await dev.close()
    }
  })
})
