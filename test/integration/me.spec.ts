import { Controller, Get } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createUser } from './support/factories.js'

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

  async function loginAs(email: string, password = 'correct-password'): Promise<string> {
    const res = await t.http().post('/api/v1/auth/login').send({ email, password })
    return res.body.data.token as string
  }

  it('returns the current User (without the password hash) for a valid JWT', async () => {
    const user = await createUser({ name: 'Bia', email: 'bia@example.com', role: 'SUPER_ADMIN' })
    const token = await loginAs('bia@example.com')

    const res = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })

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

  it('answers 401 UNAUTHENTICATED without a token', async () => {
    const res = await t.http().get('/api/v1/me')

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })

  it('answers 401 UNAUTHENTICATED for a malformed or wrongly signed token', async () => {
    const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync({ sub: '1' })

    for (const token of ['garbage', forged]) {
      const res = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })
      expect(res.status).toBe(401)
      expect(res.body).toEqual(UNAUTHENTICATED)
    }
  })

  it('answers 401 UNAUTHENTICATED for an expired token', async () => {
    const user = await createUser()
    const now = Math.floor(Date.now() / 1000)
    const expired = await new JwtService({ secret: t.config.jwtSecret }).signAsync({
      sub: String(user.id),
      iat: now - 13 * 3600,
      exp: now - 3600,
    })

    const res = await t.http().get('/api/v1/me').auth(expired, { type: 'bearer' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })

  it('answers 401 UNAUTHENTICATED for a token issued before the last password change', async () => {
    const user = await createUser({ email: 'caio@example.com' })
    const token = await loginAs('caio@example.com')
    await testPrisma().user.update({
      where: { id: user.id },
      data: { passwordChangedAt: new Date(Date.now() + 2000) },
    })

    const res = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })

    expect(res.status).toBe(401)
    expect(res.body).toEqual(UNAUTHENTICATED)
  })

  it('answers 401 UNAUTHENTICATED when the User no longer exists', async () => {
    const user = await createUser({ email: 'dani@example.com' })
    const token = await loginAs('dani@example.com')
    await testPrisma().user.delete({ where: { id: user.id } })

    const res = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })

    expect(res.status).toBe(401)
  })

  it('protects any route without @Public() through the global guard', async () => {
    await createUser({ email: 'edu@example.com' })
    const token = await loginAs('edu@example.com')

    const anonymous = await t.http().get('/api/v1/test-private')
    const authenticated = await t.http().get('/api/v1/test-private').auth(token, { type: 'bearer' })

    expect(anonymous.status).toBe(401)
    expect(anonymous.body).toEqual(UNAUTHENTICATED)
    expect(authenticated.status).toBe(200)
  })
})
