import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ActivateUserUseCase } from '../../src/modules/identity/application/use-cases/activate-user.use-case.js'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createActivationLink, createUser } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })
const STRONG = 'a-strong-password'

describe('POST /api/v1/auth/activate', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  afterAll(() => t.close())

  function activate(token: string, password = STRONG) {
    return t.http().post('/api/v1/auth/activate').send({ token, password })
  }

  it('sets the password and returns a session, after which login works', async () => {
    const pedro = await createUser({ name: 'Pedro', email: 'pedro@example.com', password: null })
    const { token } = await createActivationLink({ userId: pedro.id })

    const res = await activate(token)

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({
      token: expect.any(String),
      user: {
        id: pedro.id,
        name: 'Pedro',
        email: 'pedro@example.com',
        role: 'USER',
        createdAt: pedro.createdAt.toISOString(),
      },
    })
    const me = await t.http().get('/api/v1/me').auth(res.body.data.token, { type: 'bearer' })
    expect(me.status).toBe(200)
    const login = await t
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'pedro@example.com', password: STRONG })
    expect(login.status).toBe(200)
  })

  it('answers 400 ACTIVATION_LINK_INVALID for an unknown token', async () => {
    const res = await activate('not-a-real-token')

    expect(res.status).toBe(400)
    expect(res.body).toEqual(error('ACTIVATION_LINK_INVALID'))
  })

  it('answers 409 ACTIVATION_LINK_USED for a used token', async () => {
    const user = await createUser({ password: null })
    const { token } = await createActivationLink({ userId: user.id })
    await activate(token)

    const res = await activate(token, 'another-strong-password')

    expect(res.status).toBe(409)
    expect(res.body).toEqual(error('ACTIVATION_LINK_USED'))
  })

  it('answers 410 ACTIVATION_LINK_EXPIRED for an expired token', async () => {
    const user = await createUser({ password: null })
    const { token } = await createActivationLink({
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    })

    const res = await activate(token)

    expect(res.status).toBe(410)
    expect(res.body).toEqual(error('ACTIVATION_LINK_EXPIRED'))
  })

  it('answers 400 WEAK_PASSWORD and keeps the link usable', async () => {
    const user = await createUser({ password: null })
    const { token } = await createActivationLink({ userId: user.id })

    const weak = await activate(token, 'short')
    const retry = await activate(token)

    expect(weak.status).toBe(400)
    expect(weak.body).toEqual(error('WEAK_PASSWORD'))
    expect(retry.status).toBe(200)
  })

  it('activates only once when the same token is used concurrently', async () => {
    const user = await createUser({ password: null })
    const { token } = await createActivationLink({ userId: user.id })
    const activateUser = t.app.get(ActivateUserUseCase)

    const results = await Promise.allSettled([
      activateUser.execute({ token, password: 'first-strong-password' }),
      activateUser.execute({ token, password: 'second-strong-password' }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected')
    expect(rejected?.reason).toMatchObject({ code: 'ACTIVATION_LINK_USED' })
  })

  it('rejects an invalid body with 400 VALIDATION_ERROR', async () => {
    const res = await t.http().post('/api/v1/auth/activate').send({ token: '' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('deletes the links of a deleted User', async () => {
    const user = await createUser({ password: null })
    await createActivationLink({ userId: user.id })

    await testPrisma().user.delete({ where: { id: user.id } })

    expect(await testPrisma().activationLink.count({ where: { userId: user.id } })).toBe(0)
  })
})
