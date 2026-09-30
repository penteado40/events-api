import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { as, MEMBER_NOW, memberRows, memberScenario } from '../testing/member-fixtures.js'
import { TransferPrimaryOwnerUseCase } from './transfer-primary-owner.use-case.js'

describe('TransferPrimaryOwnerUseCase', () => {
  let s: Awaited<ReturnType<typeof memberScenario>>
  let transfer: TransferPrimaryOwnerUseCase

  beforeEach(async () => {
    s = await memberScenario()
    transfer = new TransferPrimaryOwnerUseCase(s.events, s.users, s.clock)
  })

  it('hands the post to another Owner; the former stays on as Owner organizador', async () => {
    const result = await transfer.execute({ actor: as.primary, eventId: s.event.id, userId: 11 })

    expect(result.map(({ member }) => [member.userId, member.isPrimaryOwner])).toEqual([
      [10, false],
      [11, true],
      [12, false],
      [13, false],
    ])
    expect(await memberRows(s.events, s.event.id)).toEqual([
      [10, 'OWNER', false],
      [11, 'OWNER', true],
      [12, 'MANAGER', false],
      [13, 'VIEWER', false],
    ])
    const former = await s.events.findMember(s.event.id, 10)
    const next = await s.events.findMember(s.event.id, 11)
    expect([former?.updatedById, next?.updatedById, next?.updatedAt]).toEqual([10, 10, MEMBER_NOW])
  })

  it('lets the Super admin name the Primary owner of an Event that has none', async () => {
    const event = await s.events.create(newEventProps(), null, { by: 1, at: MEMBER_NOW })
    s.events.addMember(event.id, 12, { role: 'OWNER', isPrimaryOwner: false })

    await transfer.execute({ actor: as.superAdmin, eventId: event.id, userId: 12 })

    expect(await memberRows(s.events, event.id)).toEqual([[12, 'OWNER', true]])
  })

  it('refuses a target who is not an Owner with TRANSFER_TARGET_NOT_OWNER', async () => {
    await expect(
      transfer.execute({ actor: as.primary, eventId: s.event.id, userId: 12 }),
    ).rejects.toEqual(new AppError('TRANSFER_TARGET_NOT_OWNER'))
  })

  it('refuses an Owner organizador with FORBIDDEN', async () => {
    await expect(
      transfer.execute({ actor: as.organizer, eventId: s.event.id, userId: 11 }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('refuses an Owner organizador with FORBIDDEN before looking the target up', async () => {
    await expect(
      transfer.execute({ actor: as.organizer, eventId: s.event.id, userId: 14 }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('refuses someone who is not a member with MEMBER_NOT_FOUND', async () => {
    await expect(
      transfer.execute({ actor: as.primary, eventId: s.event.id, userId: 14 }),
    ).rejects.toEqual(new AppError('MEMBER_NOT_FOUND'))
  })

  it('changes nothing when the post already is theirs', async () => {
    await transfer.execute({ actor: as.primary, eventId: s.event.id, userId: 10 })

    expect((await s.events.findMember(s.event.id, 10))?.updatedById).toBe(1)
  })
})
