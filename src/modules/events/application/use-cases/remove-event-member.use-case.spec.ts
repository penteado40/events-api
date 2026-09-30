import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { as, MEMBER_NOW, memberRows, memberScenario } from '../testing/member-fixtures.js'
import { RemoveEventMemberUseCase } from './remove-event-member.use-case.js'

describe('RemoveEventMemberUseCase', () => {
  let s: Awaited<ReturnType<typeof memberScenario>>
  let removeMember: RemoveEventMemberUseCase

  beforeEach(async () => {
    s = await memberScenario()
    removeMember = new RemoveEventMemberUseCase(s.events, s.accounts)
  })

  it('lets an Owner remove a Manager', async () => {
    await removeMember.execute({ actor: as.organizer, eventId: s.event.id, userId: 12 })

    expect(await memberRows(s.events, s.event.id)).toEqual([
      [10, 'OWNER', true],
      [11, 'OWNER', false],
      [13, 'VIEWER', false],
    ])
  })

  it('lets a Viewer leave on their own', async () => {
    await removeMember.execute({ actor: as.viewer, eventId: s.event.id, userId: 13 })

    expect(await s.events.findMember(s.event.id, 13)).toBeNull()
  })

  it('refuses a Viewer removing someone else with FORBIDDEN', async () => {
    await expect(
      removeMember.execute({ actor: as.viewer, eventId: s.event.id, userId: 12 }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('refuses an Owner organizador removing another Owner with FORBIDDEN', async () => {
    await expect(
      removeMember.execute({ actor: as.organizer, eventId: s.event.id, userId: 10 }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('keeps even the Super admin from removing the Primary owner before a transfer', async () => {
    await expect(
      removeMember.execute({ actor: as.superAdmin, eventId: s.event.id, userId: 10 }),
    ).rejects.toEqual(new AppError('PRIMARY_OWNER_MUST_TRANSFER'))
  })

  it('refuses leaving an Archived event with EVENT_ARCHIVED', async () => {
    const event = await s.events.findById(s.event.id)
    event?.archive({ by: 10, at: MEMBER_NOW })

    await expect(
      removeMember.execute({ actor: as.viewer, eventId: s.event.id, userId: 13 }),
    ).rejects.toEqual(new AppError('EVENT_ARCHIVED'))
  })

  it('refuses someone who is not a member with MEMBER_NOT_FOUND', async () => {
    await expect(
      removeMember.execute({ actor: as.primary, eventId: s.event.id, userId: 14 }),
    ).rejects.toEqual(new AppError('MEMBER_NOT_FOUND'))
  })

  describe('a Pending user losing their last link', () => {
    beforeEach(() => {
      s.users.add({ id: 13, isPending: true })
      s.accounts.links.set(13, 'live-link')
    })

    it('drops their Activation link', async () => {
      await removeMember.execute({ actor: as.primary, eventId: s.event.id, userId: 13 })

      expect(s.accounts.links.has(13)).toBe(false)
    })

    it('keeps it while they are a member of another Event', async () => {
      const other = await s.events.create(newEventProps(), null, { by: 1, at: MEMBER_NOW })
      s.events.addMember(other.id, 13, { role: 'VIEWER', isPrimaryOwner: false })

      await removeMember.execute({ actor: as.primary, eventId: s.event.id, userId: 13 })

      expect(s.accounts.links.get(13)).toBe('live-link')
    })
  })
})
