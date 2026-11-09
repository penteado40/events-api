import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import {
  createGroup,
  createGroupMember,
  createTeam,
  createUser,
  sessionTokenFor,
} from './support/factories.js'

function errorOf(code: string) {
  return { error: { code, message: expect.any(String) } }
}

describe('Teams', () => {
  let t: TestApp
  let adminId: number
  let adminToken: string
  let groupId: number
  let ownerId: number
  let ownerToken: string
  let viewerToken: string
  let outsiderToken: string

  beforeAll(async () => {
    t = await createTestApp()
    const admin = await createUser({ email: 'admin.teams@example.com', role: 'SUPER_ADMIN' })
    adminId = admin.id
    adminToken = sessionTokenFor(admin)
  })

  beforeEach(async () => {
    await testPrisma().team.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    const group = await createGroup({ name: 'Vocal Livre' })
    groupId = group.id
    const owner = await createUser()
    const viewer = await createUser()
    const outsider = await createUser()
    ownerId = owner.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    ownerToken = sessionTokenFor(owner)
    viewerToken = sessionTokenFor(viewer)
    outsiderToken = sessionTokenFor(outsider)
  })

  afterAll(() => t.close())

  const teamsUrl = () => `/api/v1/groups/${groupId}/teams`

  describe('POST /api/v1/groups/:id/teams', () => {
    it('lets an Owner create a Team, recording them as the Author', async () => {
      const res = await t
        .http()
        .post(teamsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: '  Banda  ' })

      expect(res.status).toBe(201)
      expect(res.body).toEqual({
        data: { id: expect.any(Number), groupId, name: 'Banda', createdAt: expect.any(String) },
      })
      const row = await testPrisma().team.findUniqueOrThrow({ where: { id: res.body.data.id } })
      expect(row).toMatchObject({ createdById: ownerId, updatedById: ownerId })
    })

    it('lets the Super admin create a Team in any Group, as its Author', async () => {
      const res = await t
        .http()
        .post(teamsUrl())
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Banda' })

      expect(res.status).toBe(201)
      const row = await testPrisma().team.findUniqueOrThrow({ where: { id: res.body.data.id } })
      expect(row).toMatchObject({ createdById: adminId, updatedById: adminId })
    })

    it('refuses a name the Group already has with 409 TEAM_NAME_TAKEN', async () => {
      await createTeam({ groupId, name: 'Banda' })

      const res = await t
        .http()
        .post(teamsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Banda' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('TEAM_NAME_TAKEN'))
      expect(await testPrisma().team.count()).toBe(1)
    })

    it('allows the same name in another Group', async () => {
      const other = await createGroup()
      await createTeam({ groupId: other.id, name: 'Banda' })

      const res = await t
        .http()
        .post(teamsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Banda' })

      expect(res.status).toBe(201)
    })

    it('refuses a Viewer with 403 FORBIDDEN', async () => {
      const res = await t
        .http()
        .post(teamsUrl())
        .auth(viewerToken, { type: 'bearer' })
        .send({ name: 'Banda' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(await testPrisma().team.count()).toBe(0)
    })

    it('answers 404 to who is not a Group member', async () => {
      const res = await t
        .http()
        .post(teamsUrl())
        .auth(outsiderToken, { type: 'bearer' })
        .send({ name: 'Banda' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('refuses an empty or unknown body with 400 VALIDATION_ERROR', async () => {
      const empty = await t
        .http()
        .post(teamsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: '   ' })
      const extra = await t
        .http()
        .post(teamsUrl())
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Banda', color: 'red' })

      expect(empty.status).toBe(400)
      expect(empty.body.error.code).toBe('VALIDATION_ERROR')
      expect(extra.status).toBe(400)
    })

    it('answers 401 without a token', async () => {
      const res = await t.http().post(teamsUrl()).send({ name: 'Banda' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/groups/:id/teams', () => {
    beforeEach(async () => {
      await createTeam({ groupId, name: 'Técnica' })
      await createTeam({ groupId, name: 'Banda' })
      const other = await createGroup()
      await createTeam({ groupId: other.id, name: 'Cantores' })
    })

    it('lists the Teams of the Group by name to a Viewer, an Owner and the Super admin', async () => {
      for (const token of [viewerToken, ownerToken, adminToken]) {
        const res = await t.http().get(teamsUrl()).auth(token, { type: 'bearer' })

        expect(res.status).toBe(200)
        expect(res.body.data.map((team: { name: string }) => team.name)).toEqual([
          'Banda',
          'Técnica',
        ])
      }
    })

    it('answers 404 to who is not a Group member', async () => {
      const res = await t.http().get(teamsUrl()).auth(outsiderToken, { type: 'bearer' })

      expect(res.status).toBe(404)
      expect(res.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('answers 401 without a token', async () => {
      expect((await t.http().get(teamsUrl())).status).toBe(401)
    })
  })

  describe('PATCH /api/v1/groups/:id/teams/:teamId', () => {
    it('lets an Owner rename a Team, recording them as the editor', async () => {
      const team = await createTeam({ groupId, name: 'Banda' })

      const res = await t
        .http()
        .patch(`${teamsUrl()}/${team.id}`)
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: ' Músicos ' })

      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({ id: team.id, groupId, name: 'Músicos' })
      const row = await testPrisma().team.findUniqueOrThrow({ where: { id: team.id } })
      expect(row).toMatchObject({ name: 'Músicos', updatedById: ownerId, createdById: null })
    })

    it('refuses a name another Team of the Group has with 409 TEAM_NAME_TAKEN', async () => {
      const team = await createTeam({ groupId, name: 'Banda' })
      await createTeam({ groupId, name: 'Técnica' })

      const res = await t
        .http()
        .patch(`${teamsUrl()}/${team.id}`)
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Técnica' })

      expect(res.status).toBe(409)
      expect(res.body).toEqual(errorOf('TEAM_NAME_TAKEN'))
    })

    it('refuses a Viewer with 403 FORBIDDEN, keeping the name', async () => {
      const team = await createTeam({ groupId, name: 'Banda' })

      const res = await t
        .http()
        .patch(`${teamsUrl()}/${team.id}`)
        .auth(viewerToken, { type: 'bearer' })
        .send({ name: 'Músicos' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect((await testPrisma().team.findUniqueOrThrow({ where: { id: team.id } })).name).toBe(
        'Banda',
      )
    })

    it('answers 404 to who is not a Group member, and for a Team of another Group', async () => {
      const team = await createTeam({ groupId, name: 'Banda' })
      const other = await createGroup()
      const foreign = await createTeam({ groupId: other.id, name: 'Cantores' })

      const outsider = await t
        .http()
        .patch(`${teamsUrl()}/${team.id}`)
        .auth(outsiderToken, { type: 'bearer' })
        .send({ name: 'Músicos' })
      const wrongGroup = await t
        .http()
        .patch(`${teamsUrl()}/${foreign.id}`)
        .auth(ownerToken, { type: 'bearer' })
        .send({ name: 'Músicos' })

      expect(outsider.status).toBe(404)
      expect(wrongGroup.status).toBe(404)
      expect(wrongGroup.body).toEqual(errorOf('NOT_FOUND'))
    })

    it('answers 401 without a token', async () => {
      const team = await createTeam({ groupId })

      const res = await t.http().patch(`${teamsUrl()}/${team.id}`).send({ name: 'Músicos' })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/v1/groups/:id/teams/:teamId', () => {
    it('lets an Owner delete a Team', async () => {
      const team = await createTeam({ groupId })

      const res = await t
        .http()
        .delete(`${teamsUrl()}/${team.id}`)
        .auth(ownerToken, { type: 'bearer' })

      expect(res.status).toBe(204)
      expect(await testPrisma().team.count()).toBe(0)
    })

    it('lets the Super admin delete a Team', async () => {
      const team = await createTeam({ groupId })

      const res = await t
        .http()
        .delete(`${teamsUrl()}/${team.id}`)
        .auth(adminToken, { type: 'bearer' })

      expect(res.status).toBe(204)
    })

    it('refuses a Viewer with 403 FORBIDDEN, keeping the Team', async () => {
      const team = await createTeam({ groupId })

      const res = await t
        .http()
        .delete(`${teamsUrl()}/${team.id}`)
        .auth(viewerToken, { type: 'bearer' })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(errorOf('FORBIDDEN'))
      expect(await testPrisma().team.count()).toBe(1)
    })

    it('answers 404 to who is not a Group member, and for a Team of another Group', async () => {
      const team = await createTeam({ groupId })
      const other = await createGroup()
      const foreign = await createTeam({ groupId: other.id })

      const outsider = await t
        .http()
        .delete(`${teamsUrl()}/${team.id}`)
        .auth(outsiderToken, { type: 'bearer' })
      const wrongGroup = await t
        .http()
        .delete(`${teamsUrl()}/${foreign.id}`)
        .auth(ownerToken, { type: 'bearer' })

      expect(outsider.status).toBe(404)
      expect(wrongGroup.status).toBe(404)
      expect(await testPrisma().team.count()).toBe(2)
    })

    it('answers 401 without a token', async () => {
      const team = await createTeam({ groupId })

      expect((await t.http().delete(`${teamsUrl()}/${team.id}`)).status).toBe(401)
    })
  })

  it('deletes the Teams with their Group', async () => {
    await createTeam({ groupId })

    await testPrisma().group.delete({ where: { id: groupId } })

    expect(await testPrisma().team.count()).toBe(0)
  })
})
