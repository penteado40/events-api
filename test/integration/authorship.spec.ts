import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSuperAdmin } from '../../scripts/create-super-admin.js'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { loadTestEnv } from './support/env.js'
import { createUser } from './support/factories.js'

const STRONG = 'A-strong-password-1'

/**
 * Every write records its Author and time (ADR-0013). The API does not expose
 * authorship yet, so each test reads the stored row.
 */
describe('Authorship of the records (ADR-0013)', () => {
  let t: TestApp
  let adminId: number
  let adminToken: string

  beforeAll(async () => {
    t = await createTestApp()
    adminId = (await createUser({ email: 'admin@example.com', role: 'SUPER_ADMIN' })).id
    adminToken = await loginAs('admin@example.com')
  })

  afterAll(() => t.close())

  async function loginAs(email: string, password = 'correct-password'): Promise<string> {
    const res = await t.http().post('/api/v1/auth/login').send({ email, password })
    return res.body.data.token as string
  }

  function authorOf(row: { createdById: number | null; updatedById: number | null } | null) {
    return { createdById: row?.createdById, updatedById: row?.updatedById }
  }

  it('records the Super admin as the Author of a new User and of their Activation link', async () => {
    const res = await t
      .http()
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Pedro', email: 'pedro@example.com' })
    const userId = res.body.data.user.id as number

    const user = await testPrisma().user.findUnique({ where: { id: userId } })
    const link = await testPrisma().activationLink.findFirst({ where: { userId } })
    expect(authorOf(user)).toEqual({ createdById: adminId, updatedById: adminId })
    expect(authorOf(link)).toEqual({ createdById: adminId, updatedById: adminId })
    expect(user?.updatedAt).toEqual(user?.createdAt)
  })

  it('records the Pending user as the Author of their own activation, on the User and the link', async () => {
    const created = await t
      .http()
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Bia', email: 'bia@example.com' })
    const userId = created.body.data.user.id as number

    await t
      .http()
      .post('/api/v1/auth/activate')
      .send({ token: created.body.data.activationToken, password: STRONG })
      .expect(200)

    const user = await testPrisma().user.findUnique({ where: { id: userId } })
    const link = await testPrisma().activationLink.findFirst({ where: { userId } })
    expect(authorOf(user)).toEqual({ createdById: adminId, updatedById: userId })
    expect(authorOf(link)).toEqual({ createdById: adminId, updatedById: userId })
    expect(user?.updatedAt).toEqual(user?.passwordChangedAt)
    expect(link?.updatedAt).toEqual(link?.usedAt)
  })

  it('records the Super admin as the Author of a reissued Activation link', async () => {
    const pending = await createUser({ email: 'lia@example.com', password: null })

    await t
      .http()
      .post(`/api/v1/users/${pending.id}/activation-link`)
      .auth(adminToken, { type: 'bearer' })
      .expect(201)

    const link = await testPrisma().activationLink.findFirst({ where: { userId: pending.id } })
    expect(authorOf(link)).toEqual({ createdById: adminId, updatedById: adminId })
  })

  it('records the User as the Author of their password change', async () => {
    const ana = await createUser({ email: 'ana@example.com' })
    const token = await loginAs('ana@example.com')

    await t
      .http()
      .patch('/api/v1/me/password')
      .auth(token, { type: 'bearer' })
      .send({ currentPassword: 'correct-password', newPassword: 'Brand-new-password-1' })
      .expect(200)

    const user = await testPrisma().user.findUnique({ where: { id: ana.id } })
    expect(user?.updatedById).toBe(ana.id)
    expect(user?.updatedAt).toEqual(user?.passwordChangedAt)
  })

  it('records no Author for the Super admin the platform script creates', async () => {
    const { user } = await createSuperAdmin(loadTestEnv().databaseUrl, {
      email: 'root@example.com',
      name: 'Root',
      password: STRONG,
    })

    const row = await testPrisma().user.findUnique({ where: { id: user.id } })
    expect(authorOf(row)).toEqual({ createdById: null, updatedById: null })
  })

  it('refuses to delete a User who is the Author of a record: a User is never deleted', async () => {
    await t
      .http()
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({ name: 'Caio', email: 'caio@example.com' })
      .expect(201)

    await expect(testPrisma().user.delete({ where: { id: adminId } })).rejects.toThrow()
  })
})
