import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import { createGroup, createGroupMember, createUser, sessionTokenFor } from './support/factories.js'

function errorOf(code: string) {
  return { error: { code, message: expect.any(String) } }
}

describe('Groups', () => {
  let t: TestApp
  let adminId: number
  let adminToken: string

  beforeAll(async () => {
    t = await createTestApp()
    const admin = await createUser({ email: 'admin@example.com', role: 'SUPER_ADMIN' })
    adminId = admin.id
    adminToken = sessionTokenFor(admin)
  })

  beforeEach(async () => {
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
  })

  afterAll(() => t.close())

  describe('POST /api/v1/groups', () => {
    it('lets the Super admin create a Group with no Group members, as its Author', async () => {
      const res = await t
        .http()
        .post('/api/v1/groups')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: '  Vocal Livre  ' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: { id: expect.any(Number), name: 'Vocal Livre', createdAt: expect.any(String) },
      })
      const row = await testPrisma().group.findUniqueOrThrow({
        where: { id: res.body.data.id },
        include: { members: true },
      })
      expect(row).toMatchObject({ createdById: adminId, updatedById: adminId, members: [] })
    })

    it('refuses a User who is not the Super admin with 403 FORBIDDEN', async () => {
      const ana = await createUser({ email: 'ana.create@example.com' })

      const res = await t
        .http()
        .post('/api/v1/groups')
        .auth(sessionTokenFor(ana), { type: 'bearer' })
        .send({ name: 'Vocal Livre' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(await testPrisma().group.count()).toBe(0)
    })

    it('refuses an empty name with 400 VALIDATION_ERROR', async () => {
      const res = await t
        .http()
        .post('/api/v1/groups')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: '   ' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 401 without a token', async () => {
      const res = await t.http().post('/api/v1/groups').send({ name: 'Vocal Livre' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/groups', () => {
    it('lists every Group to the Super admin, by name', async () => {
      await createGroup({ name: 'Vocal Livre' })
      await createGroup({ name: 'Banda Norte' })

      const res = await t.http().get('/api/v1/groups').auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(200)
      expect(res.body.data.map((g: { name: string }) => g.name)).toEqual([
        'Banda Norte',
        'Vocal Livre',
      ])
    })

    it('lists to a User only the Groups they are a Group member of', async () => {
      const ana = await createUser({ email: 'ana.list@example.com' })
      const vocal = await createGroup({ name: 'Vocal Livre' })
      const banda = await createGroup({ name: 'Banda Norte' })
      await createGroup({ name: 'Coral Alegria' })
      await createGroupMember({ groupId: vocal.id, userId: ana.id, role: 'VIEWER' })
      await createGroupMember({ groupId: banda.id, userId: ana.id, role: 'OWNER' })

      const res = await t.http().get('/api/v1/groups').auth(sessionTokenFor(ana), {
        type: 'bearer',
      })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: [
          { id: banda.id, name: 'Banda Norte', createdAt: banda.createdAt.toISOString() },
          { id: vocal.id, name: 'Vocal Livre', createdAt: vocal.createdAt.toISOString() },
        ],
      })
    })

    it('lists nothing to a User who is in no Group', async () => {
      await createGroup({ name: 'Vocal Livre' })
      const caio = await createUser({ email: 'caio.list@example.com' })

      const res = await t.http().get('/api/v1/groups').auth(sessionTokenFor(caio), {
        type: 'bearer',
      })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: [] })
    })
  })

  describe('PATCH /api/v1/groups/:id', () => {
    it('lets the Super admin rename a Group, as its last Author', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t
        .http()
        .patch(`/api/v1/groups/${group.id}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Vocal Livre Oficial' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: {
          id: group.id,
          name: 'Vocal Livre Oficial',
          createdAt: group.createdAt.toISOString(),
        },
      })
      const row = await testPrisma().group.findUniqueOrThrow({ where: { id: group.id } })
      expect(row).toMatchObject({ name: 'Vocal Livre Oficial', updatedById: adminId })
    })

    it('answers 404 NOT_FOUND for a Group that does not exist', async () => {
      const res = await t
        .http()
        .patch('/api/v1/groups/999999')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Vocal' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('answers 404 NOT_FOUND to a User who is not a Group member of the Group', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const caio = await createUser({ email: 'caio.rename@example.com' })

      const res = await t
        .http()
        .patch(`/api/v1/groups/${group.id}`)
        .auth(sessionTokenFor(caio), { type: 'bearer' })
        .send({ name: 'Vocal' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('refuses an Owner of the Group with 403 FORBIDDEN, keeping the name', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const bia = await createUser({ email: 'bia.rename@example.com' })
      await createGroupMember({ groupId: group.id, userId: bia.id, role: 'OWNER' })

      const res = await t
        .http()
        .patch(`/api/v1/groups/${group.id}`)
        .auth(sessionTokenFor(bia), { type: 'bearer' })
        .send({ name: 'Vocal' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      const row = await testPrisma().group.findUniqueOrThrow({ where: { id: group.id } })
      expect(row.name).toBe('Vocal Livre')
    })
  })
})
