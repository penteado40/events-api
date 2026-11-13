import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GroupDirectory } from '../../src/modules/events/application/ports/group-directory.js'
import { EditEventUseCase } from '../../src/modules/events/application/use-cases/edit-event.use-case.js'
import type { NewChange } from '../../src/modules/events/domain/change.js'
import { ChangeRepository } from '../../src/modules/events/domain/change.repository.js'
import { EventRepository } from '../../src/modules/events/domain/event.repository.js'
import { Clock } from '../../src/shared/application/clock.js'
import { FixedClock } from '../../src/shared/application/testing/fixed-clock.js'
import { UnitOfWork } from '../../src/shared/application/unit-of-work.js'
import type { Stamp } from '../../src/shared/domain/stamp.js'
import { PrismaUnitOfWork } from '../../src/shared/infrastructure/prisma-unit-of-work.js'
import { createTestApp, type TestApp } from './support/app.js'
import { testPrisma } from './support/database.js'
import {
  createEvent,
  createGroup,
  createGroupMember,
  createUser,
  sessionTokenFor,
} from './support/factories.js'

const NOW = new Date('2026-11-13T15:00:00.000Z')
const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const MANAUS_PERIOD = { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' }

/**
 * Every edit of an Event writes its Changes in the same transaction
 * (amendment of ADR-0010): both commit or neither does.
 */
describe('Changes of an Event', () => {
  let t: TestApp
  const clock = new FixedClock(NOW)
  let groupId: number
  let ownerId: number
  let viewerId: number
  let ownerToken: string
  let eventId: number

  beforeAll(async () => {
    t = await createTestApp({
      override: (builder) => builder.overrideProvider(Clock).useValue(clock),
    })
  })

  beforeEach(async () => {
    await testPrisma().change.deleteMany()
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    groupId = (await createGroup({ name: 'Vocal Livre' })).id
    const otherGroupId = (await createGroup({ name: 'Outro' })).id
    const owner = await createUser()
    const viewer = await createUser()
    const outsider = await createUser()
    ownerId = owner.id
    viewerId = viewer.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    await createGroupMember({ groupId: otherGroupId, userId: outsider.id, role: 'OWNER' })
    ownerToken = sessionTokenFor(owner)
    const event = await createEvent({
      groupId,
      name: 'Show em Manaus',
      place: 'Manaus',
      ...MANAUS_PERIOD,
    })
    eventId = event.id
    await testPrisma().event.update({ where: { id: eventId }, data: { updatedAt: CREATED_AT } })
  })

  afterAll(() => t.close())

  const patch = (body: object) =>
    t.http().patch(`/api/v1/events/${eventId}`).auth(ownerToken, { type: 'bearer' }).send(body)

  const changeRows = () =>
    testPrisma().change.findMany({ where: { eventId }, orderBy: { id: 'asc' } })

  it('writes one Change per attribute that changed, with Author, instant, before, after and reach', async () => {
    const period = { startDate: '2026-11-12', endDate: '2026-11-16', timezone: 'America/Manaus' }

    const res = await patch({ name: 'Shows em Manaus', place: 'Teatro Amazonas', period })

    expect(res.status).toBe(200)
    const reach = [ownerId, viewerId]
    expect(await changeRows()).toEqual([
      expect.objectContaining({
        attribute: 'name',
        before: 'Show em Manaus',
        after: 'Shows em Manaus',
        productionOnly: false,
        reachBefore: reach,
        reachAfter: reach,
        createdById: ownerId,
        createdAt: NOW,
      }),
      expect.objectContaining({
        attribute: 'place',
        before: 'Manaus',
        after: 'Teatro Amazonas',
        createdById: ownerId,
        createdAt: NOW,
      }),
      expect.objectContaining({
        attribute: 'period',
        before: MANAUS_PERIOD,
        after: period,
        createdById: ownerId,
        createdAt: NOW,
      }),
    ])
  })

  it('writes a Change only for what changed', async () => {
    await patch({ name: 'Show em Manaus', place: 'Teatro Amazonas' })

    expect((await changeRows()).map((c) => c.attribute)).toEqual(['place'])
  })

  it('writes no Change, and leaves the Event untouched, when nothing changed', async () => {
    const res = await patch({ name: ' Show em Manaus ', period: MANAUS_PERIOD })

    expect(res.status).toBe(200)
    expect(await changeRows()).toEqual([])
    const row = await testPrisma().event.findUniqueOrThrow({ where: { id: eventId } })
    expect(row).toMatchObject({ updatedAt: CREATED_AT, updatedById: null })
  })

  it('undoes the edit and its Changes together when the unit fails after the Changes are written', async () => {
    const changeLog = t.app.get(ChangeRepository)
    const unitOfWork = t.app.get(PrismaUnitOfWork)
    let writtenInsideTheUnit = 0
    class FailingAfterWrite extends ChangeRepository {
      async create(id: number, changes: readonly NewChange[], stamp: Stamp): Promise<void> {
        await changeLog.create(id, changes, stamp)
        writtenInsideTheUnit = await unitOfWork
          .transaction()
          .change.count({ where: { eventId: id } })
        throw new Error('forced failure after writing the Changes')
      }
    }
    const editEvent = new EditEventUseCase(
      t.app.get(GroupDirectory),
      t.app.get(EventRepository),
      new FailingAfterWrite(),
      t.app.get(UnitOfWork),
      clock,
    )

    await expect(
      editEvent.execute({
        actor: { id: ownerId, isSuperAdmin: false },
        eventId,
        name: 'Turnê',
        place: 'Teatro Amazonas',
      }),
    ).rejects.toThrow('forced failure after writing the Changes')

    expect(writtenInsideTheUnit).toBe(2)
    expect(await changeRows()).toEqual([])
    const row = await testPrisma().event.findUniqueOrThrow({ where: { id: eventId } })
    expect(row).toMatchObject({ name: 'Show em Manaus', place: 'Manaus', updatedAt: CREATED_AT })
  })
})
