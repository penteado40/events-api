import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser } from './support/factories.js'

describe('docs with DOCS_ENABLED=true', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ env: { DOCS_ENABLED: 'true' } })
    await createUser({ email: 'docs@example.com', password: 'correct-password' })
    await createUser({ email: 'pending@example.com', password: null })
  })

  afterAll(() => t.close())

  it('serves the OpenAPI document with the auth, me and users routes', async () => {
    const res = await t.http().get('/api/v1/openapi')

    expect(res.status).toBe(200)
    expect(res.body.openapi).toMatch(/^3\./)
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/auth/login',
        '/api/v1/auth/activate',
        '/api/v1/me',
        '/api/v1/me/password',
        '/api/v1/users',
        '/api/v1/users/{id}/activation-link',
      ]),
    )
    expect(res.body.components.securitySchemes.oauth2.flows.password.tokenUrl).toBe(
      '/api/v1/auth/token',
    )
  })

  it('serves Scalar with a CSP relaxed only for its CDN', async () => {
    const res = await t.http().get('/api/v1/docs')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('/api/v1/openapi')
    const csp = res.headers['content-security-policy']
    expect(csp).toContain("default-src 'none'")
    expect(csp).toMatch(/script-src 'nonce-[^']+' https:\/\/cdn\.jsdelivr\.net/)
    expect(csp).not.toContain("script-src 'unsafe-inline'")
  })

  it('issues an OAuth2 token from a form-urlencoded password grant', async () => {
    const res = await t.http().post('/api/v1/auth/token').type('form').send({
      grant_type: 'password',
      username: 'DOCS@example.com',
      password: 'correct-password',
    })

    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toEqual({
      access_token: expect.any(String),
      token_type: 'bearer',
      expires_in: 43200,
    })

    const me = await t.http().get('/api/v1/me').auth(res.body.access_token, { type: 'bearer' })
    expect(me.status).toBe(200)
  })

  it('answers bad credentials with 400 invalid_grant (RFC 6749)', async () => {
    const res = await t.http().post('/api/v1/auth/token').type('form').send({
      grant_type: 'password',
      username: 'docs@example.com',
      password: 'wrong-password',
    })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_grant' })
  })

  it('answers a Pending user with 400 invalid_grant too', async () => {
    const res = await t.http().post('/api/v1/auth/token').type('form').send({
      grant_type: 'password',
      username: 'pending@example.com',
      password: 'anything',
    })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_grant' })
  })

  it('answers other grant types with 400 unsupported_grant_type', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/token')
      .type('form')
      .send({ grant_type: 'client_credentials', username: 'a', password: 'b' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'unsupported_grant_type' })
  })
})

describe('docs with DOCS_ENABLED=false', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ env: { DOCS_ENABLED: 'false' } })
  })

  afterAll(() => t.close())

  it.each([
    ['GET', '/api/v1/docs'],
    ['GET', '/api/v1/openapi'],
    ['POST', '/api/v1/auth/token'],
  ])('%s %s answers 404', async (method, path) => {
    const res = method === 'GET' ? await t.http().get(path) : await t.http().post(path).send({})

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
