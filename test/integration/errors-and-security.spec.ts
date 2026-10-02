import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UserRepository } from '../../src/modules/identity/domain/user.repository.js'
import { createTestApp, type TestApp } from './support/app.js'

const brokenUsers = {
  findByEmail: () => Promise.reject(new Error('connection to db-internal.example:5432 lost')),
}

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
      .post('/api/v1/auth/login')
      .send({ email: 'a'.repeat(200_000), password: 'x' })

    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } })
  })

  it('sends the security headers on success and on error responses', async () => {
    const error = await t.http().get('/api/v1/me')
    const success = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'x@example.com', password: 'x' })
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
    })
    try {
      const res = await prod
        .http()
        .post('/api/v1/auth/login')
        .send({ email: 'ana@example.com', password: 'whatever' })

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
      const res = await dev
        .http()
        .post('/api/v1/auth/login')
        .send({ email: 'ana@example.com', password: 'whatever' })

      expect(res.status).toBe(500)
      expect(res.body.error.code).toBe('INTERNAL_ERROR')
      expect(res.body.error.message).toContain('db-internal')
    } finally {
      await dev.close()
    }
  })
})
