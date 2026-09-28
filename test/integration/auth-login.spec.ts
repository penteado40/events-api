import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { createUser } from './support/factories.js'

describe('POST /api/v1/auth/login', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
    await createUser({ name: 'Ana', email: 'ana@example.com', password: 'correct-password' })
  })

  afterAll(() => t.close())

  it('returns { data: { token, user } } for valid credentials, without the password hash', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'correct-password' })

    expect(res.status).toBe(200)
    expect(res.body.data.token).toEqual(expect.any(String))
    expect(res.body.data.user).toEqual({
      id: expect.any(Number),
      name: 'Ana',
      email: 'ana@example.com',
      role: 'USER',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
    })
  })

  it('accepts the email in upper case and with surrounding spaces', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: '  ANA@Example.com ', password: 'correct-password' })

    expect(res.status).toBe(200)
  })

  it('answers a wrong password and an unknown email with the same 401 INVALID_CREDENTIALS', async () => {
    const wrongPassword = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@example.com', password: 'wrong-password' })
    const unknownEmail = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'correct-password' })

    expect(wrongPassword.status).toBe(401)
    expect(wrongPassword.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: expect.any(String) },
    })
    expect(unknownEmail.status).toBe(401)
    expect(unknownEmail.body).toEqual(wrongPassword.body)
  })

  it('answers 403 USER_PENDING for a Pending user, whatever the password', async () => {
    await createUser({ email: 'pedro@example.com', password: null })

    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'pedro@example.com', password: 'anything' })

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: { code: 'USER_PENDING', message: expect.any(String) } })
  })

  it('rejects an invalid body with 400 VALIDATION_ERROR and { path, message } details', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: 'email', message: expect.any(String) },
        { path: 'password', message: expect.any(String) },
      ]),
    )
  })

  it('rejects malformed JSON with 400 VALIDATION_ERROR', async () => {
    const res = await t
      .http()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
