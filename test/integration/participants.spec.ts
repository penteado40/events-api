import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import {
  createEvent,
  createGroup,
  createGroupMember,
  createUser,
  sessionTokenFor,
} from './support/factories.js'

function errorOf(code: string) {
  return { error: { code, message: expect.any(String) } }
}

const MANAUS = {
  name: 'Shows em Manaus',
  place: 'Manaus - AM',
  period: { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' },
}

describe('Participants', () => {
  let t: TestApp
  let run = 0
  let adminToken: string
  let groupId: number
  let ana: { id: number; token: string }
  let bia: { id: number; token: string }
  let caio: { id: number; token: string }
  let duda: { id: number; token: string }
  let outsiderToken: string

  beforeAll(async () => {
    t = await createTestApp()
    const admin = await createUser({ email: 'admin.participants@example.com', role: 'SUPER_ADMIN' })
    adminToken = sessionTokenFor(admin)
  })

  // The Vocal Livre: two Owners (Ana, Caio) and two Viewers (Bia, Duda), in the order they joined.
  beforeEach(async () => {
    run += 1
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    groupId = (await createGroup({ name: 'Vocal Livre' })).id
    const otherGroupId = (await createGroup({ name: 'Outro' })).id
    async function member(name: string, phone: string, role: 'OWNER' | 'VIEWER') {
      const user = await createUser({
        name,
        phone,
        email: `${name.toLowerCase()}${run}@example.com`,
      })
      await createGroupMember({ groupId, userId: user.id, role })
      return { id: user.id, token: sessionTokenFor(user) }
    }
    ana = await member('Ana', '+5592911111111', 'OWNER')
    bia = await member('Bia', '+5592922222222', 'VIEWER')
    caio = await member('Caio', '+5592933333333', 'OWNER')
    duda = await member('Duda', '+5592944444444', 'VIEWER')
    const outsider = await createUser()
    await createGroupMember({ groupId: otherGroupId, userId: outsider.id, role: 'OWNER' })
    outsiderToken = sessionTokenFor(outsider)
  })

  afterAll(() => t.close())

  const participantsUrl = (eventId: number) => `/api/v1/events/${eventId}/participants`

  async function createManausAs(token: string): Promise<number> {
    const res = await t
      .http()
      .post(`/api/v1/groups/${groupId}/events`)
      .auth(token, { type: 'bearer' })
      .send(MANAUS)
    expect(res.status).toBe(201)
    return res.body.data.id
  }

  const VOCAL_LIVRE = () => [
    { userId: ana.id, name: 'Ana', phone: '+5592911111111', role: 'OWNER' },
    { userId: bia.id, name: 'Bia', phone: '+5592922222222', role: 'VIEWER' },
    { userId: caio.id, name: 'Caio', phone: '+5592933333333', role: 'OWNER' },
    { userId: duda.id, name: 'Duda', phone: '+5592944444444', role: 'VIEWER' },
  ]

  describe('POST /api/v1/groups/:id/events', () => {
    it('copies every Group member of the Vocal Livre, Owners and Viewers, to the Participants, as the Author', async () => {
      const eventId = await createManausAs(ana.token)

      const rows = await testPrisma().participant.findMany({
        where: { eventId },
        orderBy: { id: 'asc' },
      })
      expect(rows.map((r) => r.userId)).toEqual([ana.id, bia.id, caio.id, duda.id])
      expect(rows.every((r) => r.createdById === ana.id && r.updatedById === ana.id)).toBe(true)
    })

    it('copies nobody when the Event is refused', async () => {
      const res = await t
        .http()
        .post(`/api/v1/groups/${groupId}/events`)
        .auth(ana.token, { type: 'bearer' })
        .send({ ...MANAUS, period: { ...MANAUS.period, endDate: '2026-11-12' } })

      expect(res.status).toBe(400)
      expect(await testPrisma().participant.count()).toBe(0)
    })
  })

  describe('GET /api/v1/events/:id/participants', () => {
    it('shows a Viewer the name, phone and role of each Participant, in the order of the list', async () => {
      const eventId = await createManausAs(ana.token)

      const res = await t.http().get(participantsUrl(eventId)).auth(bia.token, { type: 'bearer' })

      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: VOCAL_LIVRE() })
    })

    it('leaves out a Viewer added to the Group after the Event was created', async () => {
      const eventId = await createManausAs(caio.token)

      const added = await t
        .http()
        .post(`/api/v1/groups/${groupId}/viewers`)
        .auth(ana.token, { type: 'bearer' })
        .send({ email: `edu${run}@example.com`, name: 'Edu', phone: '+5592955555555' })
      expect(added.status).toBe(201)
      const edu = added.body.data.member.user

      const res = await t.http().get(participantsUrl(eventId)).auth(ana.token, { type: 'bearer' })
      expect(res.body.data.map((p: { userId: number }) => p.userId)).not.toContain(edu.id)
      expect(res.body).toEqual({ data: VOCAL_LIVRE() })
      // A new Event copies the Group of now, Edu included.
      const nextId = await createManausAs(ana.token)
      const next = await t.http().get(participantsUrl(nextId)).auth(ana.token, { type: 'bearer' })
      expect(next.body.data.map((p: { name: string }) => p.name)).toEqual([
        'Ana',
        'Bia',
        'Caio',
        'Duda',
        'Edu',
      ])
    })

    it('shows the list to a Group member who is not a Participant, and to the Super admin', async () => {
      const eventId = await createManausAs(ana.token)
      await testPrisma().participant.deleteMany({ where: { eventId, userId: duda.id } })

      const byDuda = await t
        .http()
        .get(participantsUrl(eventId))
        .auth(duda.token, { type: 'bearer' })
      const byAdmin = await t
        .http()
        .get(participantsUrl(eventId))
        .auth(adminToken, { type: 'bearer' })

      expect(byDuda.status).toBe(200)
      expect(byDuda.body.data.map((p: { name: string }) => p.name)).toEqual(['Ana', 'Bia', 'Caio'])
      expect(byAdmin.body).toEqual(byDuda.body)
    })

    it('answers 404 to who is not a Group member of its Group, and for an Event that does not exist', async () => {
      const eventId = await createManausAs(ana.token)

      const outsider = await t
        .http()
        .get(participantsUrl(eventId))
        .auth(outsiderToken, { type: 'bearer' })
      const missing = await t
        .http()
        .get(participantsUrl(eventId + 1000))
        .auth(adminToken, { type: 'bearer' })

      expect(outsider.status).toBe(404)
      expect(outsider.body).toEqual(errorOf('NOT_FOUND'))
      expect(missing.status).toBe(404)
    })

    it('answers 401 without a token', async () => {
      const eventId = (await createEvent({ groupId })).id

      const res = await t.http().get(participantsUrl(eventId))

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/events/:id', () => {
    it('tells who asks whether they are a Participant, and gives the Super admin no Membership', async () => {
      const eventId = await createManausAs(ana.token)
      await testPrisma().participant.deleteMany({ where: { eventId, userId: duda.id } })

      const byBia = await t
        .http()
        .get(`/api/v1/events/${eventId}`)
        .auth(bia.token, { type: 'bearer' })
      const byDuda = await t
        .http()
        .get(`/api/v1/events/${eventId}`)
        .auth(duda.token, { type: 'bearer' })
      const byAdmin = await t
        .http()
        .get(`/api/v1/events/${eventId}`)
        .auth(adminToken, { type: 'bearer' })

      expect(byBia.body.data.membership).toEqual({ isParticipant: true })
      expect(byDuda.body.data.membership).toEqual({ isParticipant: false })
      expect(byAdmin.body.data.membership).toBeNull()
    })
  })
})
