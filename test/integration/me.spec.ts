import { Controller, Get } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FakeAuthVerifier } from '../../src/modules/identity/application/testing/fake-auth-verifier.js'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createUser, sessionTokenFor } from './support/factories.js'

/** A route with no `@Public()`: the global guard must protect it. */
@Controller('test-private')
class PrivateTestController {
  @Get()
  ping() {
    return { data: 'pong' }
  }
}

const UNAUTHENTICATED = { error: { code: 'UNAUTHENTICATED', message: expect.any(String) } }
const USER_DEACTIVATED = { error: { code: 'USER_DEACTIVATED', message: expect.any(String) } }

describe('GET /api/v1/me', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp({ controllers: [PrivateTestController] })
  })

  afterAll(() => t.close())

  async function clerkIdOf(userId: number): Promise<string | null> {
    const row = await testPrisma().user.findUniqueOrThrow({ where: { id: userId } })
    return row.clerkId
  }

  it('returns the User already linked to the Clerk user of the token', async () => {
    const user = await createUser({
      name: 'Bia',
      email: 'bia@example.com',
      role: 'SUPER_ADMIN',
      clerkId: 'user_bia',
    })

    const res = await t.http().get('/api/v1/me').auth(sessionTokenFor(user), { type: 'bearer' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: {
        id: user.id,
        name: 'Bia',
        email: 'bia@example.com',
        role: 'SUPER_ADMIN',
        createdAt: user.createdAt.toISOString(),
      },
    })
  })

  it('links an unknown Clerk user to the User with its email, then uses the link', async () => {
    const user = await createUser({ email: 'caio@example.com' })
    const first = FakeAuthVerifier.tokenFor({ externalId: 'user_caio', email: 'caio@example.com' })

    const res = await t.http().get('/api/v1/me').auth(first, { type: 'bearer' })

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(user.id)
    expect(await clerkIdOf(user.id)).toBe('user_caio')

    // Linked: the Clerk user is found by its id, whatever email the token carries.
    const later = FakeAuthVerifier.tokenFor({ externalId: 'user_caio', email: 'caio@new.example' })
    const again = await t.http().get('/api/v1/me').auth(later, { type: 'bearer' })
    expect(again.status).toBe(200)
    expect(again.body.data.id).toBe(user.id)
  })

  it('answers 401 USER_NOT_INVITED when the email belongs to no User', async () => {
    const token = FakeAuthVerifier.tokenFor({ externalId: 'user_x', email: 'nobody@example.com' })

    const res = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: { code: 'USER_NOT_INVITED', message: expect.any(String) } })
    expect(await testPrisma().user.count({ where: { email: 'nobody@example.com' } })).toBe(0)
  })

  it('refuses an email whose User is linked to another Clerk user, keeping the link', async () => {
    const user = await createUser({ email: 'dani@example.com', clerkId: 'user_dani' })
    const token = FakeAuthVerifier.tokenFor({ externalId: 'user_other', email: 'dani@example.com' })

    const res = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
    expect(await clerkIdOf(user.id)).toBe('user_dani')
  })

  it('answers 401 USER_DEACTIVATED to a Deactivated user with a valid token, on any route', async () => {
    const user = await createUser({
      email: 'fabi@example.com',
      clerkId: 'user_fabi',
      deactivatedAt: new Date(),
    })
    const token = sessionTokenFor(user)

    for (const path of ['/api/v1/me', '/api/v1/test-private']) {
      const res = await t.http().get(path).auth(token, { type: 'bearer' })
      expect(res.status, path).toBe(401)
      expect(res.body).toEqual(USER_DEACTIVATED)
    }
  })

  it('answers 401 USER_DEACTIVATED on the first sign-in of a Deactivated user, without linking', async () => {
    const user = await createUser({ email: 'hugo@example.com', deactivatedAt: new Date() })

    const res = await t.http().get('/api/v1/me').auth(sessionTokenFor(user), { type: 'bearer' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual(USER_DEACTIVATED)
    expect(await clerkIdOf(user.id)).toBeNull()
  })

  it('answers 401 UNAUTHENTICATED without a token', async () => {
    const res = await t.http().get('/api/v1/me')

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })

  // The Site's X-Api-Key left with the Sites (ADR-0016): it is no credential.
  it('answers 401 UNAUTHENTICATED for an X-Api-Key without a Bearer token', async () => {
    const res = await t.http().get('/api/v1/me').set('X-Api-Key', 'evt_whatever')

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })

  it('answers 401 UNAUTHENTICATED for a token the verifier refuses', async () => {
    const user = await createUser({ email: 'edu@example.com' })
    const valid = sessionTokenFor(user)

    for (const authorization of ['Bearer garbage', `Basic ${valid}`, 'Bearer', valid]) {
      const res = await t.http().get('/api/v1/me').set('Authorization', authorization)
      expect(res.status, authorization).toBe(401)
      expect(res.body).toEqual(UNAUTHENTICATED)
    }
  })

  it.each([
    ['post', '/api/v1/auth/login'],
    ['post', '/api/v1/auth/activate'],
    ['post', '/api/v1/auth/token'],
    ['patch', '/api/v1/me/password'],
  ] as const)(
    'answers 404 for %s %s: sign-in and passwords live in Clerk',
    async (method, path) => {
      const user = await createUser()

      const res = await t
        .http()
        [method](path)
        .auth(sessionTokenFor(user), { type: 'bearer' })
        .send({})

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    },
  )

  it('protects any route without @Public() through the global guard', async () => {
    const user = await createUser({ email: 'gil@example.com' })
    const token = sessionTokenFor(user)

    const anonymous = await t.http().get('/api/v1/test-private')
    const authenticated = await t.http().get('/api/v1/test-private').auth(token, { type: 'bearer' })

    expect(anonymous.status).toBe(401)
    expect(anonymous.body).toEqual(UNAUTHENTICATED)
    expect(authenticated.status).toBe(200)
  })
})
