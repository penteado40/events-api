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
      phone: '+5511987654321',
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
        phone: '+5511987654321',
        role: 'SUPER_ADMIN',
        createdAt: user.createdAt.toISOString(),
        isSuperAdmin: true,
        memberships: [],
      },
    })
  })

  // No Groups exist yet (PROJ-168, PROJ-172, PROJ-177): nobody has a Membership.
  it('tells a User apart from the Super admin, with no Membership while there are no Groups', async () => {
    const user = await createUser({ email: 'duda@example.com', clerkId: 'user_duda' })

    const res = await t.http().get('/api/v1/me').auth(sessionTokenFor(user), { type: 'bearer' })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ id: user.id, isSuperAdmin: false, memberships: [] })
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

describe('PATCH /api/v1/me', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  async function storedUser(userId: number) {
    return testPrisma().user.findUniqueOrThrow({ where: { id: userId } })
  }

  it('changes the name and the phone, stored normalized, authored by the User', async () => {
    const user = await createUser({ name: 'Ivo', email: 'ivo@example.com', clerkId: 'user_ivo' })

    const res = await t
      .http()
      .patch('/api/v1/me')
      .auth(sessionTokenFor(user), { type: 'bearer' })
      .send({ name: ' Ivo Lima ', phone: '+55 (21) 98765-4321' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: {
        id: user.id,
        name: 'Ivo Lima',
        email: 'ivo@example.com',
        phone: '+5521987654321',
        role: 'USER',
        createdAt: user.createdAt.toISOString(),
        isSuperAdmin: false,
        memberships: [],
      },
    })
    const stored = await storedUser(user.id)
    expect(stored).toMatchObject({
      name: 'Ivo Lima',
      phone: '+5521987654321',
      createdById: null,
      updatedById: user.id,
    })
    expect(stored.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime())
  })

  it('keeps what the body leaves out', async () => {
    const user = await createUser({ name: 'Jade', phone: '+5511900000001' })

    const res = await t
      .http()
      .patch('/api/v1/me')
      .auth(sessionTokenFor(user), { type: 'bearer' })
      .send({ name: 'Jade Reis' })

    expect(res.status).toBe(200)
    expect(await storedUser(user.id)).toMatchObject({ name: 'Jade Reis', phone: '+5511900000001' })
  })

  it.each([
    ['an email', { name: 'Leo', email: 'other@example.com' }],
    ['nothing to change', {}],
    ['a blank name', { name: '   ' }],
  ])('answers 400 VALIDATION_ERROR for a body with %s, changing nothing', async (_, body) => {
    const user = await createUser({ name: 'Leo' })

    const res = await t
      .http()
      .patch('/api/v1/me')
      .auth(sessionTokenFor(user), { type: 'bearer' })
      .send(body)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(await storedUser(user.id)).toMatchObject({ name: 'Leo', email: user.email })
  })

  it('answers 400 VALIDATION_ERROR for a phone without the country code, changing nothing', async () => {
    const user = await createUser({ name: 'Mel', phone: '+5511900000002' })

    const res = await t
      .http()
      .patch('/api/v1/me')
      .auth(sessionTokenFor(user), { type: 'bearer' })
      .send({ name: 'Mel Dias', phone: '98765-4321' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: expect.any(String) } })
    expect(await storedUser(user.id)).toMatchObject({ name: 'Mel', phone: '+5511900000002' })
  })

  it('answers 401 UNAUTHENTICATED without a token', async () => {
    const res = await t.http().patch('/api/v1/me').send({ name: 'Nina' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })
})
