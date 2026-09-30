import { beforeEach, describe, expect, it } from 'vitest'
import { PrismaEventRepository } from '../../src/modules/events/infrastructure/prisma-event.repository.js'
import { AppError } from '../../src/shared/domain/app-error.js'
import { testPrisma } from './support/database.js'
import { addMember, createEvent, createUser } from './support/factories.js'

const STAMP = { by: null, at: new Date('2026-09-30T12:00:00.000Z') }

/**
 * Two requests read the same links, then both write (ADR-0014): the second
 * write finds the row changed and is refused, instead of silently undoing
 * the first or failing with a database error.
 */
describe('Concurrent writes on Event members (ADR-0014)', () => {
  const events = new PrismaEventRepository(testPrisma())
  let eventId: number
  let primaryId: number
  let ownerId: number
  let managerId: number

  beforeEach(async () => {
    eventId = (await createEvent()).id
    primaryId = (await createUser()).id
    ownerId = (await createUser()).id
    managerId = (await createUser()).id
    await addMember({ eventId, userId: primaryId, role: 'OWNER', isPrimaryOwner: true })
    await addMember({ eventId, userId: ownerId, role: 'OWNER' })
    await addMember({ eventId, userId: managerId, role: 'MANAGER' })
  })

  async function read(userId: number) {
    const member = await events.findMember(eventId, userId)
    if (!member) throw new Error('arranged member missing')
    return member
  }

  async function stored() {
    const rows = await testPrisma().eventMember.findMany({
      where: { eventId },
      orderBy: { id: 'asc' },
    })
    return rows.map((m) => [m.userId, m.role, m.isPrimaryOwner])
  }

  it('refuses a transfer to an Owner demoted meanwhile, keeping the demotion', async () => {
    const [former, next] = [await read(primaryId), await read(ownerId)]
    const demoted = await read(ownerId)
    demoted.changeRole('MANAGER', STAMP)
    await events.saveMember(demoted)

    former.stepDownAsPrimaryOwner(STAMP)
    next.becomePrimaryOwner(STAMP)
    await expect(events.savePrimaryOwnerChange(former, next)).rejects.toEqual(
      new AppError('MEMBER_CHANGED'),
    )
    expect(await stored()).toEqual([
      [primaryId, 'OWNER', true],
      [ownerId, 'MANAGER', false],
      [managerId, 'MANAGER', false],
    ])
  })

  it('refuses the second of two concurrent transfers, not a database error', async () => {
    const [formerA, nextA] = [await read(primaryId), await read(ownerId)]
    await testPrisma().eventMember.updateMany({
      where: { eventId, userId: managerId },
      data: { role: 'OWNER' },
    })
    const [formerB, nextB] = [await read(primaryId), await read(managerId)]

    formerA.stepDownAsPrimaryOwner(STAMP)
    nextA.becomePrimaryOwner(STAMP)
    await events.savePrimaryOwnerChange(formerA, nextA)

    formerB.stepDownAsPrimaryOwner(STAMP)
    nextB.becomePrimaryOwner(STAMP)
    await expect(events.savePrimaryOwnerChange(formerB, nextB)).rejects.toEqual(
      new AppError('MEMBER_CHANGED'),
    )
    expect(await stored()).toEqual([
      [primaryId, 'OWNER', false],
      [ownerId, 'OWNER', true],
      [managerId, 'OWNER', false],
    ])
  })

  it('refuses a transfer to someone removed meanwhile', async () => {
    const [former, next] = [await read(primaryId), await read(ownerId)]
    await events.deleteMember(await read(ownerId))

    former.stepDownAsPrimaryOwner(STAMP)
    next.becomePrimaryOwner(STAMP)
    await expect(events.savePrimaryOwnerChange(former, next)).rejects.toEqual(
      new AppError('MEMBER_CHANGED'),
    )
    expect(await stored()).toEqual([
      [primaryId, 'OWNER', true],
      [managerId, 'MANAGER', false],
    ])
  })

  it('refuses removing someone who became the Primary owner meanwhile', async () => {
    const toRemove = await read(ownerId)
    const [former, next] = [await read(primaryId), await read(ownerId)]
    former.stepDownAsPrimaryOwner(STAMP)
    next.becomePrimaryOwner(STAMP)
    await events.savePrimaryOwnerChange(former, next)

    await expect(events.deleteMember(toRemove)).rejects.toEqual(new AppError('MEMBER_CHANGED'))
    expect(await stored()).toContainEqual([ownerId, 'OWNER', true])
  })
})
