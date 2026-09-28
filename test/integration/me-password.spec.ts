import { JwtService } from '@nestjs/jwt'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

describe('PATCH /api/v1/me/password', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  /**
   * A session issued a few seconds ago. JWT `iat` has second precision, so a
   * token from a login in the same second as the change would survive it.
   */
  async function sessionIssuedEarlier(userId: number): Promise<string> {
    const iat = Math.floor(Date.now() / 1000) - 5
    return new JwtService({ secret: t.config.jwtSecret }).signAsync({
      sub: String(userId),
      iat,
      exp: iat + 3600,
    })
  }

  it('changes the password, revokes older sessions and returns a working one', async () => {
    const ana = await createUser({ email: 'ana@example.com', password: 'current-password' })
    const oldToken = await sessionIssuedEarlier(ana.id)

    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .auth(oldToken, { type: 'bearer' })
      .send({ currentPassword: 'current-password', newPassword: 'brand-new-password' })

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      token: expect.any(String),
      user: expect.objectContaining({ id: ana.id, email: 'ana@example.com' }),
    })
    const withOld = await t.http().get('/api/v1/me').auth(oldToken, { type: 'bearer' })
    const newToken = res.body.data.token as string
    const withNew = await t.http().get('/api/v1/me').auth(newToken, { type: 'bearer' })
    expect(withOld.status).toBe(401)
    expect(withNew.status).toBe(200)

    const oldPassword = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'current-password' })
    const newPassword = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'brand-new-password' })
    expect(oldPassword.status).toBe(401)
    expect(newPassword.status).toBe(200)
  })

  it('answers 400 INVALID_CURRENT_PASSWORD for a wrong current password, keeping the session', async () => {
    const user = await createUser({ password: 'current-password' })
    const token = await sessionIssuedEarlier(user.id)

    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-password' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual(error('INVALID_CURRENT_PASSWORD'))
    const me = await t.http().get('/api/v1/me').auth(token, { type: 'bearer' })
    expect(me.status).toBe(200)
  })

  it('answers 400 WEAK_PASSWORD for a new password under 12 characters', async () => {
    const user = await createUser({ password: 'current-password' })
    const token = await sessionIssuedEarlier(user.id)

    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: 'current-password', newPassword: '12345678901' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual(error('WEAK_PASSWORD'))
  })

  it('answers 401 UNAUTHENTICATED without a token', async () => {
    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .send({ currentPassword: 'current-password', newPassword: 'brand-new-password' })

    expect(res.status).toBe(401)
  })
})
