import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GroupDirectory } from '../../src/modules/events/application/ports/group-directory.js'
import { CreateEventItemUseCase } from '../../src/modules/events/application/use-cases/create-event-item.use-case.js'
import { DeleteEventItemUseCase } from '../../src/modules/events/application/use-cases/delete-event-item.use-case.js'
import { EditEventItemUseCase } from '../../src/modules/events/application/use-cases/edit-event-item.use-case.js'
import { ReorderEventItemsUseCase } from '../../src/modules/events/application/use-cases/reorder-event-items.use-case.js'
import type { NewChange } from '../../src/modules/events/domain/change.js'
import { ChangeRepository } from '../../src/modules/events/domain/change.repository.js'
import { EventItemRepository } from '../../src/modules/events/domain/event-item.repository.js'
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

/**
 * Every write of an Event item writes its Changes in the same transaction
 * (amendment of ADR-0010): both commit or neither does. Until the reach rule
 * covers the Viewers, an Event item reaches the Owners.
 */
describe('Changes of an Event item', () => {
  let t: TestApp
  const clock = new FixedClock(NOW)
  let ownerId: number
  let ownerToken: string
  let eventId: number

  beforeAll(async () => {
    t = await createTestApp({
      override: (builder) => builder.overrideProvider(Clock).useValue(clock),
    })
  })

  beforeEach(async () => {
    await testPrisma().event.deleteMany()
    await testPrisma().groupMember.deleteMany()
    await testPrisma().group.deleteMany()
    const groupId = (await createGroup({ name: 'Vocal Livre' })).id
    const owner = await createUser()
    const viewer = await createUser()
    ownerId = owner.id
    await createGroupMember({ groupId, userId: owner.id, role: 'OWNER' })
    await createGroupMember({ groupId, userId: viewer.id, role: 'VIEWER' })
    ownerToken = sessionTokenFor(owner)
    eventId = (
      await createEvent({
        groupId,
        name: 'Shows em Manaus',
        startDate: '2026-11-13',
        endDate: '2026-11-16',
        timezone: 'America/Manaus',
      })
    ).id
  })

  afterAll(() => t.close())

  const createItem = (body: object) =>
    t.http().post(`/api/v1/events/${eventId}/items`).auth(ownerToken, { type: 'bearer' }).send(body)
  const patchItem = (itemId: number, body: object) =>
    t
      .http()
      .patch(`/api/v1/events/${eventId}/items/${itemId}`)
      .auth(ownerToken, { type: 'bearer' })
      .send(body)
  const deleteItem = (itemId: number) =>
    t
      .http()
      .delete(`/api/v1/events/${eventId}/items/${itemId}`)
      .auth(ownerToken, { type: 'bearer' })

  const changeRows = () =>
    testPrisma().change.findMany({ where: { eventId }, orderBy: { id: 'asc' } })

  async function soundcheck(): Promise<number> {
    const res = await createItem({ name: 'Passagem de som', date: '2026-11-14', time: '15:00' })
    expect(res.status).toBe(201)
    return res.body.data.id as number
  }

  it('writes the Change of the creation, with the item as born, its Author and the Owners as reach', async () => {
    const itemId = await soundcheck()

    expect(await changeRows()).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'item',
        before: null,
        after: {
          name: 'Passagem de som',
          date: '2026-11-14',
          time: '15:00',
          place: null,
          state: 'PUBLISHED',
        },
        productionOnly: false,
        reachBefore: [],
        reachAfter: [ownerId],
        createdById: ownerId,
        createdAt: NOW,
      }),
    ])
  })

  it('writes the move of the Passagem de som from 15h to 16h as a Change of the time, with its Author', async () => {
    const itemId = await soundcheck()

    const res = await patchItem(itemId, { time: '16:00' })

    expect(res.status).toBe(200)
    expect((await changeRows()).slice(1)).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'time',
        before: '15:00',
        after: '16:00',
        reachBefore: [ownerId],
        reachAfter: [ownerId],
        createdById: ownerId,
        createdAt: NOW,
      }),
    ])
  })

  it('writes one Change per attribute that changed, and none when nothing did', async () => {
    const itemId = await soundcheck()

    await patchItem(itemId, { name: 'Passagem de som (banda)', place: { name: 'Teatro Amazonas' } })
    await patchItem(itemId, { time: '15:00' })

    expect((await changeRows()).slice(1).map((c) => c.attribute)).toEqual(['name', 'place'])
  })

  it('writes the Change of the removal, kept after the item is gone', async () => {
    const itemId = await soundcheck()

    const res = await deleteItem(itemId)

    expect(res.status).toBe(204)
    expect((await changeRows()).slice(1)).toEqual([
      expect.objectContaining({
        eventItemId: itemId,
        attribute: 'item',
        before: expect.objectContaining({ name: 'Passagem de som', time: '15:00' }),
        after: null,
        reachBefore: [ownerId],
        reachAfter: [],
        createdById: ownerId,
      }),
    ])
  })

  describe('when the unit fails after the Changes are written', () => {
    let writtenInsideTheUnit: number
    let failing: ChangeRepository

    beforeEach(() => {
      const changeLog = t.app.get(ChangeRepository)
      const unitOfWork = t.app.get(PrismaUnitOfWork)
      writtenInsideTheUnit = 0
      failing = new (class extends ChangeRepository {
        async create(id: number, changes: readonly NewChange[], stamp: Stamp): Promise<void> {
          await changeLog.create(id, changes, stamp)
          writtenInsideTheUnit = await unitOfWork
            .transaction()
            .change.count({ where: { eventId: id } })
          throw new Error('forced failure after writing the Changes')
        }
      })()
    })

    const actor = () => ({ id: ownerId, isSuperAdmin: false })
    const deps = () =>
      [
        t.app.get(GroupDirectory),
        t.app.get(EventRepository),
        t.app.get(EventItemRepository),
        failing,
        t.app.get(UnitOfWork),
        clock,
      ] as const

    it('undoes the creation and its Change together', async () => {
      await expect(
        new CreateEventItemUseCase(...deps()).execute({
          actor: actor(),
          eventId,
          name: 'Passagem de som',
        }),
      ).rejects.toThrow('forced failure after writing the Changes')

      expect(writtenInsideTheUnit).toBe(1)
      expect(await changeRows()).toEqual([])
      expect(await testPrisma().eventItem.count({ where: { eventId } })).toBe(0)
    })

    it('undoes the edit and its Changes together', async () => {
      const itemId = await soundcheck()

      await expect(
        new EditEventItemUseCase(...deps()).execute({
          actor: actor(),
          eventId,
          itemId,
          name: 'Passagem de som (banda)',
          time: '16:00',
        }),
      ).rejects.toThrow('forced failure after writing the Changes')

      // The creation's Change, then the two of the edit, seen inside the unit only.
      expect(writtenInsideTheUnit).toBe(3)
      expect((await changeRows()).map((c) => c.attribute)).toEqual(['item'])
      const row = await testPrisma().eventItem.findUniqueOrThrow({ where: { id: itemId } })
      expect(row).toMatchObject({ name: 'Passagem de som', time: '15:00' })
    })

    it('undoes the removal and its Change together', async () => {
      const itemId = await soundcheck()

      await expect(
        new DeleteEventItemUseCase(...deps()).execute({ actor: actor(), eventId, itemId }),
      ).rejects.toThrow('forced failure after writing the Changes')

      expect(writtenInsideTheUnit).toBe(2)
      expect(await changeRows()).toHaveLength(1)
      expect(await testPrisma().eventItem.findUnique({ where: { id: itemId } })).not.toBeNull()
    })

    it('undoes the new order and its Change together', async () => {
      const first = (await createItem({ name: 'O que levar' })).body.data.id as number
      const second = (await createItem({ name: 'Contatos da produção' })).body.data.id as number

      await expect(
        new ReorderEventItemsUseCase(...deps()).execute({
          actor: actor(),
          eventId,
          itemIds: [second, first],
        }),
      ).rejects.toThrow('forced failure after writing the Changes')

      expect(writtenInsideTheUnit).toBe(3)
      expect((await changeRows()).map((c) => c.attribute)).toEqual(['item', 'item'])
      const rows = await testPrisma().eventItem.findMany({
        where: { eventId },
        orderBy: { position: 'asc' },
      })
      expect(rows.map((r) => r.id)).toEqual([first, second])
    })
  })
})
