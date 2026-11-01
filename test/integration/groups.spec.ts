import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GroupRosterRepository } from '../../src/modules/groups/domain/group-roster.repository.js'
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

    it('answers 401 without a token', async () => {
      const res = await t.http().get('/api/v1/groups')

      expect(res.status).toBe(401)
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

    it('refuses a name over 100 characters with 400 VALIDATION_ERROR', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t
        .http()
        .patch(`/api/v1/groups/${group.id}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'x'.repeat(101) })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 401 without a token', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t.http().patch(`/api/v1/groups/${group.id}`).send({ name: 'Vocal' })

      expect(res.status).toBe(401)
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

  describe('GET /api/v1/groups/:id', () => {
    it('shows any Group to the Super admin', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t.http().get(`/api/v1/groups/${group.id}`).auth(adminToken, {
        type: 'bearer',
      })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: { id: group.id, name: 'Vocal Livre', createdAt: group.createdAt.toISOString() },
      })
    })

    it('answers 404 NOT_FOUND to a User who is not a Group member of the Group', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const caio = await createUser({ email: 'caio.get@example.com' })

      const res = await t.http().get(`/api/v1/groups/${group.id}`).auth(sessionTokenFor(caio), {
        type: 'bearer',
      })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('answers 401 without a token', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t.http().get(`/api/v1/groups/${group.id}`)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/groups/:id/owners', () => {
    const owners = (groupId: number) => `/api/v1/groups/${groupId}/owners`
    const NEW_PERSON = { email: 'Joao@Example.com', name: ' João ', phone: '+55 21 98765-4321' }

    it('makes an existing User an Owner, with no Activation link, as its Author', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const bia = await createUser({
        name: 'Bia',
        email: 'bia.owner@example.com',
        clerkId: 'u_bia',
      })
      const openBefore = t.invitations.open().length

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ email: 'BIA.owner@example.com', name: 'Outro', phone: '+5521987654321' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          member: {
            groupId: group.id,
            role: 'OWNER',
            user: { id: bia.id, name: 'Bia', email: 'bia.owner@example.com', isPending: false },
          },
          activationLink: null,
        },
      })
      expect(t.invitations.open()).toHaveLength(openBefore)
      const row = await testPrisma().group.findUniqueOrThrow({
        where: { id: group.id },
        include: { members: true },
      })
      expect(row.hasHadOwner).toBe(true)
      expect(row.updatedById).toBe(adminId)
      expect(row.members).toEqual([
        expect.objectContaining({ userId: bia.id, role: 'OWNER', createdById: adminId }),
      ])
    })

    it('creates a Pending user for a new email and returns the Activation link', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send(NEW_PERSON)

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          member: {
            groupId: group.id,
            role: 'OWNER',
            user: {
              id: expect.any(Number),
              name: 'João',
              email: 'joao@example.com',
              isPending: true,
            },
          },
          activationLink: { url: expect.any(String), expiresAt: expect.any(String) },
        },
      })
      const invitationId = t.invitations.open().at(-1)
      expect(res.body.data.activationLink.url).toContain(invitationId)
      const user = await testPrisma().user.findUniqueOrThrow({
        where: { email: 'joao@example.com' },
        include: { activationLinks: true, groupMembers: true },
      })
      expect(user).toMatchObject({ phone: '+5521987654321', createdById: adminId, clerkId: null })
      expect(user.activationLinks.map((l) => l.invitationId)).toEqual([invitationId])
      expect(user.groupMembers).toEqual([
        expect.objectContaining({ groupId: group.id, role: 'OWNER' }),
      ])
    })

    it('lets the new Owner see the Group in GET /groups and GET /groups/:id', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      await createGroup({ name: 'Banda Norte' })
      const caio = await createUser({ email: 'caio.owner@example.com', clerkId: 'u_caio' })
      await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ email: caio.email, name: 'Caio', phone: '+5521987654321' })
      const token = sessionTokenFor(caio)

      const list = await t.http().get('/api/v1/groups').auth(token, { type: 'bearer' })
      const one = await t.http().get(`/api/v1/groups/${group.id}`).auth(token, { type: 'bearer' })

      expect(list.body.data.map((g: { id: number }) => g.id)).toEqual([group.id])
      expect(one.status).toBe(200)
      expect(one.body.data.id).toBe(group.id)
    })

    it('refuses who is already a Group member with 409 ALREADY_A_GROUP_MEMBER', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const dani = await createUser({ email: 'dani.owner@example.com' })
      await createGroupMember({ groupId: group.id, userId: dani.id, role: 'VIEWER' })

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ email: dani.email, name: 'Dani', phone: '+5521987654321' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('ALREADY_A_GROUP_MEMBER'))
      const members = await testPrisma().groupMember.findMany({ where: { groupId: group.id } })
      expect(members.map((m) => m.role)).toEqual(['VIEWER'])
    })

    it('refuses the Super admin with 409 SUPER_ADMIN_NOT_A_GROUP_MEMBER', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ email: 'admin@example.com', name: 'Admin', phone: '+5521987654321' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('SUPER_ADMIN_NOT_A_GROUP_MEMBER'))
      expect(await testPrisma().groupMember.count()).toBe(0)
    })

    it('refuses an Owner of the Group with 403 FORBIDDEN, creating no User', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const eva = await createUser({ email: 'eva.owner@example.com' })
      await createGroupMember({ groupId: group.id, userId: eva.id, role: 'OWNER' })

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(sessionTokenFor(eva), { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'nobody.forbidden@example.com' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(
        await testPrisma().user.findUnique({ where: { email: 'nobody.forbidden@example.com' } }),
      ).toBeNull()
    })

    it('answers 404 NOT_FOUND for a Group that does not exist', async () => {
      const res = await t
        .http()
        .post(owners(999999))
        .auth(adminToken, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'nobody.missing@example.com' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('refuses an invalid email with 400 VALIDATION_ERROR', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 401 without a token', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t.http().post(owners(group.id)).send(NEW_PERSON)

      expect(res.status).toBe(401)
    })

    it('revokes the Activation link when storing the Owner fails', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const rosters = t.app.get(GroupRosterRepository)
      const save = vi.spyOn(rosters, 'save').mockRejectedValueOnce(new Error('database down'))

      const res = await t
        .http()
        .post(owners(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'fail.owner@example.com' })

      save.mockRestore()
      expect(res.status).toBe(500)
      const user = await testPrisma().user.findUniqueOrThrow({
        where: { email: 'fail.owner@example.com' },
        include: { activationLinks: true, groupMembers: true },
      })
      expect(user.activationLinks).toEqual([])
      expect(user.groupMembers).toEqual([])
      expect(t.invitations.revoked().at(-1)).toMatch(/^inv_/)
      expect(t.invitations.open()).not.toContain(t.invitations.revoked().at(-1))
    })
  })
})
