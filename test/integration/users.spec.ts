import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createUser, sessionTokenFor } from './support/factories.js'

const error = (code: string) => ({ error: { code, message: expect.any(String) } })

describe('Users (Super admin)', () => {
  let t: TestApp
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    t = await createTestApp({
      env: { PLATFORM_NAME: 'Programação', EMAIL_FROM_ADDRESS: 'noreply@mail.example.com' },
    })
    adminToken = sessionTokenFor(
      await createUser({ email: 'admin@example.com', role: 'SUPER_ADMIN' }),
    )
    userToken = sessionTokenFor(await createUser({ email: 'ana@example.com', clerkId: 'user_ana' }))
  })

  afterAll(() => t.close())

  describe('POST /api/v1/users', () => {
    it('creates a Pending user and returns the Activation link (a Clerk invitation)', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: ' Pedro ', email: 'Pedro@Example.com', phone: '+55 (11) 98765-4321' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          user: {
            id: expect.any(Number),
            name: 'Pedro',
            email: 'pedro@example.com',
            phone: '+5511987654321',
            role: 'USER',
            createdAt: expect.any(String),
          },
          activationLink: { url: expect.any(String), expiresAt: expect.any(String) },
        },
      })
      const sevenDays = 7 * 24 * 3600_000
      const expiresIn = new Date(res.body.data.activationLink.expiresAt).getTime() - Date.now()
      expect(expiresIn).toBeGreaterThan(sevenDays - 60_000)
      expect(expiresIn).toBeLessThanOrEqual(sevenDays)

      const stored = await testPrisma().user.findUnique({
        where: { email: 'pedro@example.com' },
        include: { activationLinks: true },
      })
      expect(stored?.phone).toBe('+5511987654321')
      expect(stored?.clerkId).toBeNull()
      const invitationId = t.invitations.open().at(-1)
      expect(res.body.data.activationLink.url).toContain(invitationId)
      expect(stored?.activationLinks.map((l) => l.invitationId)).toEqual([invitationId])
    })

    it('emails the Activation link to the Pending user from the Platform sender, recorded in the Email log', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Bia', email: 'bia@example.com', phone: '+5511987654321' })
      await t.settle()

      expect(res.status).toBe(201)
      const sent = t.emails.sent.filter((e) => e.to === 'bia@example.com')
      expect(sent).toHaveLength(1)
      expect(sent[0]?.from).toEqual({ name: 'Programação', address: 'noreply@mail.example.com' })
      expect(sent[0]).not.toHaveProperty('replyTo')
      expect(sent[0]?.subject).toBe('Ative sua conta na Programação')
      expect(sent[0]?.text).toContain(res.body.data.activationLink.url)

      const admin = await testPrisma().user.findUniqueOrThrow({
        where: { email: 'admin@example.com' },
      })
      const logs = await testPrisma().emailLog.findMany({ where: { recipient: 'bia@example.com' } })
      expect(logs).toMatchObject([
        {
          kind: 'ACCOUNT_ACTIVATION_LINK',
          status: 'SENT',
          error: null,
          createdById: admin.id,
        },
      ])
    })

    it('still answers 201 when the email fails, recording the error in the Email log', async () => {
      t.emails.failNextSend()

      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Caio', email: 'caio@example.com', phone: '+5511987654321' })
      await t.settle()

      expect(res.status).toBe(201)
      expect(res.body.data.activationLink.url).toEqual(expect.any(String))
      expect(t.emails.sent.filter((e) => e.to === 'caio@example.com')).toEqual([])
      const logs = await testPrisma().emailLog.findMany({
        where: { recipient: 'caio@example.com' },
      })
      expect(logs).toMatchObject([
        {
          kind: 'ACCOUNT_ACTIVATION_LINK',
          status: 'FAILED',
          error: 'fake email sender: send failed',
        },
      ])
    })

    it('answers 500 and creates no User when Clerk fails to issue the invitation', async () => {
      t.invitations.failNextIssue()

      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Gabi', email: 'gabi@example.com', phone: '+5511987654321' })

      expect(res.status).toBe(500)
      expect(res.body.error.code).toBe('INTERNAL_ERROR')
      expect(await testPrisma().user.count({ where: { email: 'gabi@example.com' } })).toBe(0)
    })

    it('answers 409 EMAIL_ALREADY_IN_USE for an existing email, in any case, issuing no invitation', async () => {
      const open = t.invitations.open().length
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Other Ana', email: 'ANA@example.com', phone: '+5511987654321' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(error('EMAIL_ALREADY_IN_USE'))
      expect(t.invitations.open()).toHaveLength(open)
    })

    it('answers 403 FORBIDDEN to a User who is not the Super admin', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(userToken, { type: 'bearer' })
        .send({ name: 'Carla', email: 'carla@example.com', phone: '+5511987654321' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
      expect(await testPrisma().user.count({ where: { email: 'carla@example.com' } })).toBe(0)
    })

    it('answers 401 UNAUTHENTICATED without a token', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .send({ name: 'Carla', email: 'carla@example.com', phone: '+5511987654321' })

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

    it('answers 400 VALIDATION_ERROR without a phone, creating nothing', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Fabi', email: 'fabi@example.com' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.error.details).toEqual([{ path: 'phone', message: expect.any(String) }])
      expect(await testPrisma().user.count({ where: { email: 'fabi@example.com' } })).toBe(0)
    })

    it('answers 400 VALIDATION_ERROR for a phone without the country code', async () => {
      const res = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Fabi', email: 'fabi@example.com', phone: '(11) 98765-4321' })

      expect(res.status).toBe(400)
      expect(res.body).toEqual(error('VALIDATION_ERROR'))
      expect(await testPrisma().user.count({ where: { email: 'fabi@example.com' } })).toBe(0)
    })

    it('always creates a USER, even when the body asks for another role', async () => {
      const res = await t.http().post('/api/v1/users').auth(adminToken, { type: 'bearer' }).send({
        name: 'Duda',
        email: 'duda@example.com',
        phone: '+5511987654321',
        role: 'SUPER_ADMIN',
      })

      expect(res.status).toBe(201)
      expect(res.body.data.user.role).toBe('USER')
    })
  })

  describe('POST /api/v1/users/:id/activation-link', () => {
    it('issues a new Activation link and revokes the previous one', async () => {
      const created = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Edu', email: 'edu@example.com', phone: '+5511987654321' })
      const oldUrl = created.body.data.activationLink.url as string

      const res = await t
        .http()
        .post(`/api/v1/users/${created.body.data.user.id}/activation-link`)
        .auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: { url: expect.any(String), expiresAt: expect.any(String) },
      })
      expect(res.body.data.url).not.toBe(oldUrl)

      const links = await testPrisma().activationLink.findMany({
        where: { userId: created.body.data.user.id },
      })
      const newId = t.invitations.open().at(-1)
      expect(links.map((l) => l.invitationId)).toEqual([newId])
      expect(res.body.data.url).toContain(newId)
      const oldId = t.invitations.revoked().at(-1)
      expect(oldUrl).toMatch(new RegExp(`=${oldId}$`))
      expect(t.invitations.open()).not.toContain(oldId)
    })

    it('emails the new Activation link to the Pending user, recorded in the Email log by the Super admin', async () => {
      const created = await t
        .http()
        .post('/api/v1/users')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Iara', email: 'iara@example.com', phone: '+5511987654321' })
      await t.settle()

      const res = await t
        .http()
        .post(`/api/v1/users/${created.body.data.user.id}/activation-link`)
        .auth(adminToken, { type: 'bearer' })
      await t.settle()

      expect(res.status).toBe(201)
      const sent = t.emails.sent.filter((e) => e.to === 'iara@example.com')
      expect(sent).toHaveLength(2)
      expect(sent[1]?.subject).toBe('Ative sua conta na Programação')
      expect(sent[1]?.text).toContain(res.body.data.url)

      const admin = await testPrisma().user.findUniqueOrThrow({
        where: { email: 'admin@example.com' },
      })
      const logs = await testPrisma().emailLog.findMany({
        where: { recipient: 'iara@example.com' },
        orderBy: { id: 'asc' },
      })
      expect(logs).toMatchObject([
        { kind: 'ACCOUNT_ACTIVATION_LINK', status: 'SENT', createdById: admin.id },
        { kind: 'ACCOUNT_ACTIVATION_LINK', status: 'SENT', createdById: admin.id },
      ])
    })

    it('emails nothing for a User who already signed in', async () => {
      const ana = await testPrisma().user.findUniqueOrThrow({ where: { email: 'ana@example.com' } })

      await t
        .http()
        .post(`/api/v1/users/${ana.id}/activation-link`)
        .auth(adminToken, { type: 'bearer' })
      await t.settle()

      expect(t.emails.sent.filter((e) => e.to === 'ana@example.com')).toEqual([])
    })

    it('answers 409 USER_ALREADY_ACTIVE for a User who already signed in', async () => {
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
      const pending = await createUser()

      const res = await t
        .http()
        .post(`/api/v1/users/${pending.id}/activation-link`)
        .auth(userToken, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(error('FORBIDDEN'))
    })
  })
})
