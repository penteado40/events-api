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

  describe('POST /api/v1/groups/:id/viewers', () => {
    const viewers = (groupId: number) => `/api/v1/groups/${groupId}/viewers`
    const NEW_PERSON = { email: 'Lia@Example.com', name: ' Lia ', phone: '+55 21 98765-4321' }

    async function groupWithOwner(email: string) {
      const group = await createGroup({ name: 'Vocal Livre' })
      const owner = await createUser({ email, name: 'Dono', clerkId: `u_${email}` })
      await createGroupMember({ groupId: group.id, userId: owner.id, role: 'OWNER' })
      return { group, owner, token: sessionTokenFor(owner) }
    }

    it('creates a Pending user and a Viewer tie for a new email, answering the Activation link', async () => {
      const { group, owner, token } = await groupWithOwner('dono.new@example.com')

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send(NEW_PERSON)

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: {
          member: {
            groupId: group.id,
            role: 'VIEWER',
            user: {
              id: expect.any(Number),
              name: 'Lia',
              email: 'lia@example.com',
              isPending: true,
            },
          },
          activationLink: { url: expect.any(String), expiresAt: expect.any(String) },
        },
      })
      const user = await testPrisma().user.findUniqueOrThrow({
        where: { email: 'lia@example.com' },
        include: { groupMembers: true },
      })
      expect(user).toMatchObject({ phone: '+5521987654321', createdById: owner.id, clerkId: null })
      expect(user.groupMembers).toEqual([
        expect.objectContaining({ groupId: group.id, role: 'VIEWER', createdById: owner.id }),
      ])
      const row = await testPrisma().group.findUniqueOrThrow({ where: { id: group.id } })
      expect(row.hasHadOwner).toBe(false)
    })

    it('emails the Activation link of the Group to the Pending user, replying to the Owner', async () => {
      const { group, token } = await groupWithOwner('dono.mail@example.com')

      await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'lia.mail@example.com' })
      await t.settle()

      const sent = t.emails.sent.filter((e) => e.to === 'lia.mail@example.com')
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({ replyTo: 'dono.mail@example.com' })
    })

    it('adds an active User with no Activation link, emailing them the Group access', async () => {
      const { group, token } = await groupWithOwner('dono.active@example.com')
      const mel = await createUser({
        name: 'Mel',
        email: 'mel.viewer@example.com',
        clerkId: 'u_mel',
      })

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ email: 'MEL.viewer@example.com', name: 'Outro', phone: '+5521987654321' })
      await t.settle()

      expect(res.status).toBe(201)
      expect(res.body.data).toEqual({
        member: {
          groupId: group.id,
          role: 'VIEWER',
          user: { id: mel.id, name: 'Mel', email: 'mel.viewer@example.com', isPending: false },
        },
        activationLink: null,
      })
      const sent = t.emails.sent.filter((e) => e.to === 'mel.viewer@example.com')
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({ replyTo: 'dono.active@example.com' })
    })

    it('lets the Super admin add a Viewer to any Group', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(adminToken, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'lia.admin@example.com' })

      expect(res.status).toBe(201)
      expect(res.body.data.member.role).toBe('VIEWER')
    })

    it('lets the added Viewer see the Group in GET /groups and GET /groups/:id', async () => {
      const { group, token } = await groupWithOwner('dono.see@example.com')
      await createGroup({ name: 'Banda Norte' })
      const noa = await createUser({ email: 'noa.viewer@example.com', clerkId: 'u_noa' })
      await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ email: noa.email, name: 'Noa', phone: '+5521987654321' })
      const noaToken = sessionTokenFor(noa)

      const list = await t.http().get('/api/v1/groups').auth(noaToken, { type: 'bearer' })
      const one = await t
        .http()
        .get(`/api/v1/groups/${group.id}`)
        .auth(noaToken, { type: 'bearer' })

      expect(list.body.data.map((g: { id: number }) => g.id)).toEqual([group.id])
      expect(one.status).toBe(200)
    })

    it('refuses who is already a Group member with 409 ALREADY_A_GROUP_MEMBER', async () => {
      const { group, token } = await groupWithOwner('dono.dup@example.com')
      const rui = await createUser({ email: 'rui.viewer@example.com' })
      await createGroupMember({ groupId: group.id, userId: rui.id, role: 'OWNER' })

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ email: rui.email, name: 'Rui', phone: '+5521987654321' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('ALREADY_A_GROUP_MEMBER'))
      const tie = await testPrisma().groupMember.findFirstOrThrow({
        where: { groupId: group.id, userId: rui.id },
      })
      expect(tie.role).toBe('OWNER')
    })

    it('refuses the Super admin with 409 SUPER_ADMIN_NOT_A_GROUP_MEMBER', async () => {
      const { group, token } = await groupWithOwner('dono.sa@example.com')

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ email: 'admin@example.com', name: 'Admin', phone: '+5521987654321' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('SUPER_ADMIN_NOT_A_GROUP_MEMBER'))
    })

    it('refuses a Viewer with 403 FORBIDDEN, creating no User', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })
      const vera = await createUser({ email: 'vera.viewer@example.com' })
      await createGroupMember({ groupId: group.id, userId: vera.id, role: 'VIEWER' })

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(sessionTokenFor(vera), { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'nobody.viewer403@example.com' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(
        await testPrisma().user.findUnique({ where: { email: 'nobody.viewer403@example.com' } }),
      ).toBeNull()
    })

    it('answers 404 NOT_FOUND to an Owner of another Group', async () => {
      const { token } = await groupWithOwner('dono.other@example.com')
      const other = await createGroup({ name: 'Banda Norte' })

      const res = await t
        .http()
        .post(viewers(other.id))
        .auth(token, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'nobody.other@example.com' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('refuses an invalid email with 400 VALIDATION_ERROR', async () => {
      const { group, token } = await groupWithOwner('dono.val@example.com')

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('answers 401 without a token', async () => {
      const group = await createGroup({ name: 'Vocal Livre' })

      const res = await t.http().post(viewers(group.id)).send(NEW_PERSON)

      expect(res.status).toBe(401)
    })

    it('revokes the Activation link when storing the Viewer fails', async () => {
      const { group, token } = await groupWithOwner('dono.fail@example.com')
      const rosters = t.app.get(GroupRosterRepository)
      const save = vi.spyOn(rosters, 'save').mockRejectedValueOnce(new Error('database down'))

      const res = await t
        .http()
        .post(viewers(group.id))
        .auth(token, { type: 'bearer' })
        .send({ ...NEW_PERSON, email: 'fail.viewer@example.com' })

      save.mockRestore()
      expect(res.status).toBe(500)
      const user = await testPrisma().user.findUniqueOrThrow({
        where: { email: 'fail.viewer@example.com' },
        include: { activationLinks: true, groupMembers: true },
      })
      expect(user.activationLinks).toEqual([])
      expect(user.groupMembers).toEqual([])
      expect(t.invitations.revoked().at(-1)).toMatch(/^inv_/)
    })
  })

  describe('POST /api/v1/groups/:id/members/:userId/activation-link', () => {
    const linkOf = (groupId: number, userId: number) =>
      `/api/v1/groups/${groupId}/members/${userId}/activation-link`

    async function groupWithPendingViewer(ownerEmail: string, viewerEmail: string) {
      const group = await createGroup({ name: 'Vocal Livre' })
      const owner = await createUser({ email: ownerEmail, clerkId: `u_${ownerEmail}` })
      await createGroupMember({ groupId: group.id, userId: owner.id, role: 'OWNER' })
      const added = await t
        .http()
        .post(`/api/v1/groups/${group.id}/viewers`)
        .auth(sessionTokenFor(owner), { type: 'bearer' })
        .send({ email: viewerEmail, name: 'Lia', phone: '+5521987654321' })
      const link = added.body.data.activationLink.url as string
      return {
        group,
        owner,
        token: sessionTokenFor(owner),
        viewerId: added.body.data.member.user.id as number,
        link,
      }
    }

    it('gives the Owner a new link, revoking the previous one and emailing the Viewer', async () => {
      const { group, token, viewerId, link } = await groupWithPendingViewer(
        'dono.relink@example.com',
        'lia.relink@example.com',
      )
      await t.settle()
      const before = await testPrisma().activationLink.findFirstOrThrow({
        where: { userId: viewerId },
      })

      const res = await t.http().post(linkOf(group.id, viewerId)).auth(token, { type: 'bearer' })
      await t.settle()

      expect(res.status).toBe(201)
      expect(res.body).toEqual({ data: { url: expect.any(String), expiresAt: expect.any(String) } })
      expect(res.body.data.url).not.toBe(link)
      const stored = await testPrisma().activationLink.findMany({ where: { userId: viewerId } })
      expect(stored).toHaveLength(1)
      expect(stored[0]?.invitationId).not.toBe(before.invitationId)
      expect(t.invitations.revoked()).toContain(before.invitationId)
      const sent = t.emails.sent.filter((e) => e.to === 'lia.relink@example.com')
      expect(sent).toHaveLength(2)
      expect(sent[1]).toMatchObject({ replyTo: 'dono.relink@example.com' })
      const logs = await testPrisma().emailLog.findMany({
        where: { kind: 'GROUP_ACTIVATION_LINK', recipient: 'lia.relink@example.com' },
      })
      expect(logs).toHaveLength(2)
    })

    it('lets the Super admin do it in any Group', async () => {
      const { group, viewerId } = await groupWithPendingViewer(
        'dono.relink.sa@example.com',
        'lia.relink.sa@example.com',
      )

      const res = await t
        .http()
        .post(linkOf(group.id, viewerId))
        .auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(201)
    })

    it('refuses an active Group member with 409 USER_ALREADY_ACTIVE', async () => {
      const { group, token } = await groupWithPendingViewer(
        'dono.relink.active@example.com',
        'lia.relink.active@example.com',
      )
      const mel = await createUser({ email: 'mel.relink@example.com', clerkId: 'u_mel_relink' })
      await createGroupMember({ groupId: group.id, userId: mel.id, role: 'VIEWER' })

      const res = await t.http().post(linkOf(group.id, mel.id)).auth(token, { type: 'bearer' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('USER_ALREADY_ACTIVE'))
    })

    it('answers 404 NOT_FOUND for a User who is not a Group member of the Group', async () => {
      const { group, token } = await groupWithPendingViewer(
        'dono.relink.404@example.com',
        'lia.relink.404@example.com',
      )
      const other = await createGroup({ name: 'Banda Norte' })
      const otherMember = await createUser({ email: 'outro.relink@example.com' })
      await createGroupMember({ groupId: other.id, userId: otherMember.id, role: 'VIEWER' })

      const res = await t
        .http()
        .post(linkOf(group.id, otherMember.id))
        .auth(token, { type: 'bearer' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('refuses a Viewer with 403 FORBIDDEN, keeping the link', async () => {
      const { group, viewerId } = await groupWithPendingViewer(
        'dono.relink.403@example.com',
        'lia.relink.403@example.com',
      )
      const vera = await createUser({ email: 'vera.relink@example.com' })
      await createGroupMember({ groupId: group.id, userId: vera.id, role: 'VIEWER' })

      const res = await t
        .http()
        .post(linkOf(group.id, viewerId))
        .auth(sessionTokenFor(vera), { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(await testPrisma().activationLink.count({ where: { userId: viewerId } })).toBe(1)
    })

    it('answers 404 NOT_FOUND to an Owner of another Group', async () => {
      const { viewerId, group } = await groupWithPendingViewer(
        'dono.relink.a@example.com',
        'lia.relink.a@example.com',
      )
      const outsider = await createUser({ email: 'dono.relink.b@example.com' })
      const otherGroup = await createGroup({ name: 'Banda Norte' })
      await createGroupMember({ groupId: otherGroup.id, userId: outsider.id, role: 'OWNER' })

      const res = await t
        .http()
        .post(linkOf(group.id, viewerId))
        .auth(sessionTokenFor(outsider), { type: 'bearer' })

      expect(res.status).toBe(404)
    })

    it('answers 401 without a token', async () => {
      const res = await t.http().post(linkOf(1, 1))

      expect(res.status).toBe(401)
    })
  })

  describe('Owners leaving and changing role (ADR-0017)', () => {
    async function groupWith(...roles: ('OWNER' | 'VIEWER')[]) {
      const group = await createGroup({ name: 'Vocal Livre' })
      const users = []
      for (const role of roles) {
        const user = await createUser()
        await createGroupMember({ groupId: group.id, userId: user.id, role })
        users.push(user)
      }
      await testPrisma().group.update({ where: { id: group.id }, data: { hasHadOwner: true } })
      return { group, users }
    }

    async function rolesOf(groupId: number) {
      const rows = await testPrisma().groupMember.findMany({
        where: { groupId },
        orderBy: { id: 'asc' },
      })
      return rows.map((m) => [m.userId, m.role])
    }

    describe('DELETE /api/v1/groups/:id/owners/:userId', () => {
      it('lets the Super admin take an Owner out while another stays', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')
        const [ana, bia] = users

        const res = await t
          .http()
          .delete(`/api/v1/groups/${group.id}/owners/${ana!.id}`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(204)
        expect(await rolesOf(group.id)).toEqual([[bia!.id, 'OWNER']])
      })

      it('refuses the last Owner with 409 LAST_OWNER', async () => {
        const { group, users } = await groupWith('OWNER', 'VIEWER')

        const res = await t
          .http()
          .delete(`/api/v1/groups/${group.id}/owners/${users[0]!.id}`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(409)
        expect(res.body).toEqual(errorOf('LAST_OWNER'))
        expect(await rolesOf(group.id)).toHaveLength(2)
      })

      it('refuses an Owner taking out another Owner with 403 FORBIDDEN', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')
        const [ana, bia] = users

        const res = await t
          .http()
          .delete(`/api/v1/groups/${group.id}/owners/${bia!.id}`)
          .auth(sessionTokenFor(ana!), { type: 'bearer' })

        expect(res.status).toBe(403)
        expect(res.body).toEqual(errorOf('FORBIDDEN'))
        expect(await rolesOf(group.id)).toHaveLength(2)
      })

      it('answers 404 NOT_FOUND for a Viewer, who is not an Owner', async () => {
        const { group, users } = await groupWith('OWNER', 'VIEWER')

        const res = await t
          .http()
          .delete(`/api/v1/groups/${group.id}/owners/${users[1]!.id}`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(404)
        expect(res.body).toEqual(errorOf('NOT_FOUND'))
      })

      it('answers 401 without a token', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')

        const res = await t.http().delete(`/api/v1/groups/${group.id}/owners/${users[0]!.id}`)

        expect(res.status).toBe(401)
      })
    })

    describe('POST /api/v1/groups/:id/owners/:userId/demote', () => {
      it('lets the Super admin make an Owner a Viewer, as the Author', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')
        const [ana, bia] = users

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/owners/${ana!.id}/demote`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ data: { groupId: group.id, userId: ana!.id, role: 'VIEWER' } })
        expect(await rolesOf(group.id)).toEqual([
          [ana!.id, 'VIEWER'],
          [bia!.id, 'OWNER'],
        ])
        const row = await testPrisma().groupMember.findFirstOrThrow({ where: { userId: ana!.id } })
        expect(row.updatedById).toBe(adminId)
      })

      it('refuses the last Owner with 409 LAST_OWNER', async () => {
        const { group, users } = await groupWith('OWNER')

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/owners/${users[0]!.id}/demote`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(409)
        expect(res.body).toEqual(errorOf('LAST_OWNER'))
      })

      it('refuses an Owner demoting another Owner with 403 FORBIDDEN', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')
        const [ana, bia] = users

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/owners/${bia!.id}/demote`)
          .auth(sessionTokenFor(ana!), { type: 'bearer' })

        expect(res.status).toBe(403)
        expect(res.body).toEqual(errorOf('FORBIDDEN'))
      })
    })

    describe('POST /api/v1/groups/:id/members/:userId/promote', () => {
      it('lets the Super admin make a Viewer an Owner', async () => {
        const { group, users } = await groupWith('OWNER', 'VIEWER')
        const [ana, bia] = users

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/members/${bia!.id}/promote`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ data: { groupId: group.id, userId: bia!.id, role: 'OWNER' } })
        expect(await rolesOf(group.id)).toEqual([
          [ana!.id, 'OWNER'],
          [bia!.id, 'OWNER'],
        ])
      })

      it('gives a Group born without an Owner its first one', async () => {
        const group = await createGroup({ name: 'Vocal Livre' })
        const caio = await createUser()
        await createGroupMember({ groupId: group.id, userId: caio.id, role: 'VIEWER' })

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/members/${caio.id}/promote`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(200)
        const row = await testPrisma().group.findUniqueOrThrow({ where: { id: group.id } })
        expect(row).toMatchObject({ hasHadOwner: true, updatedById: adminId })
      })

      it('refuses an Owner promoting a Viewer with 403 FORBIDDEN', async () => {
        const { group, users } = await groupWith('OWNER', 'VIEWER')
        const [ana, bia] = users

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/members/${bia!.id}/promote`)
          .auth(sessionTokenFor(ana!), { type: 'bearer' })

        expect(res.status).toBe(403)
        expect(res.body).toEqual(errorOf('FORBIDDEN'))
      })

      it('answers 404 NOT_FOUND for someone who is not a Group member', async () => {
        const { group } = await groupWith('OWNER')
        const outsider = await createUser()

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/members/${outsider.id}/promote`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(404)
        expect(res.body).toEqual(errorOf('NOT_FOUND'))
      })
    })

    describe('POST /api/v1/groups/:id/leave', () => {
      it('lets an Owner leave while another Owner stays', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')
        const [ana, bia] = users

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/leave`)
          .auth(sessionTokenFor(ana!), { type: 'bearer' })

        expect(res.status).toBe(204)
        expect(await rolesOf(group.id)).toEqual([[bia!.id, 'OWNER']])
      })

      it('refuses the last Owner with 409 LAST_OWNER', async () => {
        const { group, users } = await groupWith('OWNER', 'VIEWER')

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/leave`)
          .auth(sessionTokenFor(users[0]!), { type: 'bearer' })

        expect(res.status).toBe(409)
        expect(res.body).toEqual(errorOf('LAST_OWNER'))
        expect(await rolesOf(group.id)).toHaveLength(2)
      })

      it('refuses a Viewer with 403 FORBIDDEN: only an Owner removes them', async () => {
        const { group, users } = await groupWith('OWNER', 'VIEWER')

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/leave`)
          .auth(sessionTokenFor(users[1]!), { type: 'bearer' })

        expect(res.status).toBe(403)
        expect(res.body).toEqual(errorOf('FORBIDDEN'))
      })

      it('answers 404 NOT_FOUND to a User who is not a Group member', async () => {
        const { group } = await groupWith('OWNER', 'OWNER')
        const outsider = await createUser()

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/leave`)
          .auth(sessionTokenFor(outsider), { type: 'bearer' })

        expect(res.status).toBe(404)
      })

      it('answers 401 without a token', async () => {
        const { group } = await groupWith('OWNER')

        const res = await t.http().post(`/api/v1/groups/${group.id}/leave`)

        expect(res.status).toBe(401)
      })
    })

    describe('POST /api/v1/groups/:id/demote-self', () => {
      it('lets an Owner become a Viewer while another Owner stays, as the Author', async () => {
        const { group, users } = await groupWith('OWNER', 'OWNER')
        const [ana, bia] = users

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/demote-self`)
          .auth(sessionTokenFor(ana!), { type: 'bearer' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ data: { groupId: group.id, userId: ana!.id, role: 'VIEWER' } })
        expect(await rolesOf(group.id)).toEqual([
          [ana!.id, 'VIEWER'],
          [bia!.id, 'OWNER'],
        ])
        const row = await testPrisma().groupMember.findFirstOrThrow({ where: { userId: ana!.id } })
        expect(row.updatedById).toBe(ana!.id)
      })

      it('refuses the last Owner with 409 LAST_OWNER', async () => {
        const { group, users } = await groupWith('OWNER')

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/demote-self`)
          .auth(sessionTokenFor(users[0]!), { type: 'bearer' })

        expect(res.status).toBe(409)
        expect(res.body).toEqual(errorOf('LAST_OWNER'))
      })

      it('refuses the Super admin with 403 FORBIDDEN: they are never a Group member', async () => {
        const { group } = await groupWith('OWNER', 'OWNER')

        const res = await t
          .http()
          .post(`/api/v1/groups/${group.id}/demote-self`)
          .auth(adminToken, { type: 'bearer' })

        expect(res.status).toBe(403)
        expect(res.body).toEqual(errorOf('FORBIDDEN'))
      })
    })
  })
})
