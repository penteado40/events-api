import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser, sessionTokenFor } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

describe('PATCH /api/v1/me/password', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  // The own password leaves in PROJ-164; until then it changes behind the Clerk session.
  it('changes the password that the old login checks', async () => {
    const ana = await createUser({ email: 'ana@example.com', password: 'current-password' })

    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .auth(sessionTokenFor(ana), { type: 'bearer' })
      .send({ currentPassword: 'current-password', newPassword: 'Brand-new-password-1' })

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      token: expect.any(String),
      user: expect.objectContaining({ id: ana.id, email: 'ana@example.com' }),
    })

    const oldPassword = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'current-password' })
    const newPassword = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'Brand-new-password-1' })
    expect(oldPassword.status).toBe(401)
    expect(newPassword.status).toBe(200)
  })

  it('answers 400 INVALID_CURRENT_PASSWORD for a wrong current password', async () => {
    const user = await createUser({ password: 'current-password' })
    const token = sessionTokenFor(user)

    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: 'wrong-password', newPassword: 'Brand-new-password-1' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual(error('INVALID_CURRENT_PASSWORD'))
  })

  it('answers 400 WEAK_PASSWORD for a new password outside the PasswordPolicy', async () => {
    const user = await createUser({ password: 'current-password' })
    const token = sessionTokenFor(user)

    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: 'current-password', newPassword: 'Abcde1!' })

    expect(res.status).toBe(400)
    expect(res.body).toEqual(error('WEAK_PASSWORD'))
  })

  it('answers 401 UNAUTHENTICATED without a token', async () => {
    const res = await t
      .http()
      .patch('/api/v1/me/password')
      .send({ currentPassword: 'current-password', newPassword: 'Brand-new-password-1' })

    expect(res.status).toBe(401)
  })
})
