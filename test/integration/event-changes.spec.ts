import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GroupDirectory } from '../../src/modules/events/application/ports/group-directory.js'
import { EditEventUseCase } from '../../src/modules/events/application/use-cases/edit-event.use-case.js'
import type { NewChange } from '../../src/modules/events/domain/change.js'
import { ChangeRepository } from '../../src/modules/events/domain/change.repository.js'
import { EventRepository } from '../../src/modules/events/domain/event.repository.js'
import { GroupRosterRepository } from '../../src/modules/groups/domain/group-roster.repository.js'
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

/** Whether the promise is still pending after `ms`. */
async function stillPending(promise: Promise<unknown>, ms: number): Promise<boolean> {
  const pending = Symbol('pending')
  const settled = promise.then(
    () => 'settled',
    () => 'settled',
  )
  const winner = await Promise.race([
    settled,
    new Promise((resolve) => setTimeout(() => resolve(pending), ms)),
  ])
  return winner === pending
}

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
    // Linked up front: the burst of concurrent edits below must not race the first sign-in.
    await testPrisma().user.update({
      where: { id: owner.id },
      data: { clerkId: `user_test_${owner.id}` },
    })
    ownerToken = sessionTokenFor({ ...owner, clerkId: `user_test_${owner.id}` })
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

  // More concurrent edits than the pool has connections: each unit must hold only its own.
  it('queues concurrent edits of the same Event, each with its Change, without exhausting the pool', async () => {
    const names = Array.from({ length: 15 }, (_, i) => `Show ${i + 1}`)

    const results = await Promise.all(names.map((name) => patch({ name })))

    expect(results.map((r) => r.status)).toEqual(names.map(() => 200))
    const rows = await changeRows()
    expect(rows).toHaveLength(15)
    // Each edit starts from what the previous one left: the Changes form one chain.
    expect(rows.map((c) => c.before)).toEqual([
      'Show em Manaus',
      ...rows.slice(0, -1).map((c) => c.after),
    ])
  }, 30_000)

  // They queue on the Group's lock, like roster writes (ADR-0014).
  it('queues concurrent edits of different Events of the same Group, each with its Change', async () => {
    const ids = [eventId]
    for (let i = 0; i < 14; i++) ids.push((await createEvent({ groupId, ...MANAUS_PERIOD })).id)

    const results = await Promise.all(
      ids.map((id) =>
        t
          .http()
          .patch(`/api/v1/events/${id}`)
          .auth(ownerToken, { type: 'bearer' })
          .send({ place: `Palco ${id}` }),
      ),
    )

    expect(results.map((r) => r.status)).toEqual(ids.map(() => 200))
    expect(await testPrisma().change.count({ where: { eventId: { in: ids } } })).toBe(15)
  }, 30_000)

  // Roster writes lock the Group's row (ADR-0014); the reach is read under that same lock.
  it('waits for a roster write in progress and records the reach it leaves', async () => {
    const unitOfWork = t.app.get(PrismaUnitOfWork)
    const rosters = t.app.get(GroupRosterRepository)
    const newcomerId = (await createUser()).id
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let locked!: () => void
    const hasLock = new Promise<void>((resolve) => (locked = resolve))

    const addsViewer = unitOfWork.run(async () => {
      await rosters.lockByGroup(groupId)
      await unitOfWork
        .transaction()
        .groupMember.create({ data: { groupId, userId: newcomerId, role: 'VIEWER' } })
      locked()
      await released
    })
    await hasLock

    const edit = Promise.resolve(patch({ name: 'Turnê' }))
    expect(await stillPending(edit, 300)).toBe(true)

    release()
    await addsViewer
    expect((await edit).status).toBe(200)
    expect(await changeRows()).toEqual([
      expect.objectContaining({
        attribute: 'name',
        reachBefore: [ownerId, viewerId, newcomerId],
        reachAfter: [ownerId, viewerId, newcomerId],
      }),
    ])
  })

  // Edits that only shared the Group's lock kept overlapping, so the lock was
  // never free for a roster write: it waited for as long as the edits went on.
  it('lets a roster write through while the Events of the Group are edited nonstop', async () => {
    const editEvent = t.app.get(EditEventUseCase)
    const unitOfWork = t.app.get(PrismaUnitOfWork)
    const rosters = t.app.get(GroupRosterRepository)
    const newcomerId = (await createUser()).id
    const ids = [eventId]
    for (let i = 0; i < 7; i++) ids.push((await createEvent({ groupId, ...MANAUS_PERIOD })).id)
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    let editing = true
    let edits = 0
    // Eight editors in a loop, each unit held a little longer, as over a slower link.
    const editors = Promise.all(
      ids.map(async (id, n) => {
        await sleep(n * 5)
        for (let i = 0; editing; i++) {
          await unitOfWork.run(async () => {
            await editEvent.execute({
              actor: { id: ownerId, isSuperAdmin: false },
              eventId: id,
              name: `Show ${i}`,
            })
            await sleep(10 + ((n * 7 + i * 13) % 30))
          })
          edits++
        }
      }),
    )
    while (edits < 16) await sleep(10)

    const started = Date.now()
    const rosterWrite = unitOfWork.run(async () => {
      await rosters.lockByGroup(groupId)
      await unitOfWork
        .transaction()
        .groupMember.create({ data: { groupId, userId: newcomerId, role: 'VIEWER' } })
    })
    // The editors stop only after the race: a roster write that wins it got through them.
    const waited = await Promise.race([
      rosterWrite.then(() => Date.now() - started),
      sleep(3_000).then(() => Infinity),
    ])
    editing = false
    await editors
    await rosterWrite

    expect(waited).toBeLessThan(3_000)
  }, 30_000)

  it('makes a roster write wait for an edit in progress', async () => {
    const editEvent = t.app.get(EditEventUseCase)
    const unitOfWork = t.app.get(PrismaUnitOfWork)
    const rosters = t.app.get(GroupRosterRepository)
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let edited!: () => void
    const hasEdited = new Promise<void>((resolve) => (edited = resolve))

    // The edit joins this unit, so its locks hold until the unit ends.
    const editing = unitOfWork.run(async () => {
      await editEvent.execute({
        actor: { id: ownerId, isSuperAdmin: false },
        eventId,
        name: 'Turnê',
      })
      edited()
      await released
    })
    await hasEdited

    const rosterWrite = unitOfWork.run(() => rosters.lockByGroup(groupId))
    expect(await stillPending(rosterWrite, 300)).toBe(true)

    release()
    await editing
    await rosterWrite
  })
})
