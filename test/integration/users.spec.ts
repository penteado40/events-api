import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

describe('Users (Super admin)', () => {
  let t: TestApp
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    t = await createTestApp()
    await createUser({ email: 'admin@example.com', role: 'SUPER_ADMIN' })
    await createUser({ email: 'ana@example.com' })
    adminToken = await loginAs('admin@example.com')
    userToken = await loginAs('ana@example.com')
  })

  afterAll(() => t.close())

  async function loginAs(email: string, password = 'correct-password'): Promise<string> {
    const res = await t.http().post('/api/v1/auth/login').send({ email, password })
    return res.body.data.token as string
  }

  describe('POST /api/v1/users', () => {
    it('creates a Pending user and returns the Activation token once', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: ' Pedro ', email: 'Pedro@Example.com' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          user: {
            id: expect.any(Number),
            name: 'Pedro',
            email: 'pedro@example.com',
            role: 'USER',
            createdAt: expect.any(String),
          },
          activationToken: expect.stringMatching(/^[\w-]{43}$/),
          expiresAt: expect.any(String),
        },
      })
      const sevenDays = 7 * 24 * 3600_000
      const expiresIn = new Date(res.body.data.expiresAt).getTime() - Date.now()
      expect(expiresIn).toBeGreaterThan(sevenDays - 60_000)
      expect(expiresIn).toBeLessThanOrEqual(sevenDays)

      const stored = await testPrisma().user.findUnique({
        where: { email: 'pedro@example.com' },
        include: { activationLinks: true },
      })
      expect(stored?.passwordHash).toBeNull()
      expect(stored?.activationLinks).toHaveLength(1)
      expect(stored?.activationLinks[0]?.tokenHash).not.toBe(res.body.data.activationToken)
    })

    it('answers 409 EMAIL_ALREADY_IN_USE for an existing email, in any case', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Other Ana', email: 'ANA@example.com' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('EMAIL_ALREADY_IN_USE'))
    })

    it('answers 403 FORBIDDEN to a User who is not the Super admin', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(userToken, { type: 'bearer' })
        .send({ name: 'Carla', email: 'carla@example.com' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
      expect(await testPrisma().user.count({ where: { email: 'carla@example.com' } })).toBe(0)
    })

    it('answers 401 UNAUTHENTICATED without a token', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .send({ name: 'Carla', email: 'carla@example.com' })

      expect(res.status).toBe(401)
    })

    it('rejects an invalid body with 400 VALIDATION_ERROR, ignoring a role field', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: '   ', email: 'not-an-email', role: 'SUPER_ADMIN' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          { path: 'name', message: expect.any(String) },
          { path: 'email', message: expect.any(String) },
        ]),
      )
    })

    it('always creates a USER, even when the body asks for another role', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Duda', email: 'duda@example.com', role: 'SUPER_ADMIN' })

      expect(res.status).toBe(201)
      expect(res.body.data.user.role).toBe('USER')
    })
  })

  describe('POST /api/v1/users/:id/activation-link', () => {
    it('issues a new token and invalidates the previous one', async () => {
      const created = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Edu', email: 'edu@example.com' })
      const oldToken = created.body.data.activationToken as string

      const res = await t
        .http()
        .post(`/api/v1/users/${created.body.data.user.id}/activation-link`)
        .auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: { activationToken: expect.any(String), expiresAt: expect.any(String) },
      })
      expect(res.body.data.activationToken).not.toBe(oldToken)

      const withOld = await t
        .http()
        .post('/api/v1/auth/activate')
        .send({ token: oldToken, password: 'a-strong-password' })
      expect(withOld.status).toBe(400)
      expect(withOld.body).toEqual(error('ACTIVATION_LINK_INVALID'))
    })

    it('answers 409 USER_ALREADY_ACTIVE for a User with a password', async () => {
      const ana = await testPrisma().user.findUniqueOrThrow({ where: { email: 'ana@example.com' } })

      const res = await t
        .http()
        .post(`/api/v1/users/${ana.id}/activation-link`)
        .auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('USER_ALREADY_ACTIVE'))
    })

    it('answers 404 NOT_FOUND for an unknown User and 400 for a non-numeric id', async () => {
      const unknown = await t
        .http()
        .post('/api/v1/users/999999/activation-link')
        .auth(adminToken, { type: 'bearer' })
      const malformed = await t
        .http()
        .post('/api/v1/users/abc/activation-link')
        .auth(adminToken, { type: 'bearer' })

      expect(unknown.status).toBe(404)
      expect(unknown.body).toEqual(error('NOT_FOUND'))
      expect(malformed.status).toBe(400)
      expect(malformed.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 403 FORBIDDEN to a User who is not the Super admin', async () => {
      const pending = await createUser({ password: null })

      const res = await t
        .http()
        .post(`/api/v1/users/${pending.id}/activation-link`)
        .auth(userToken, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })
  })
})
