import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { as, memberScenario } from '../testing/member-fixtures.js'
import { IssueMemberActivationLinkUseCase } from './issue-member-activation-link.use-case.js'

describe('IssueMemberActivationLinkUseCase', () => {
  let s: Awaited<ReturnType<typeof memberScenario>>
  let issueLink: IssueMemberActivationLinkUseCase

  beforeEach(async () => {
    s = await memberScenario()
    s.users.add({ id: 13, isPending: true })
    s.accounts.links.set(13, 'old-link')
    issueLink = new IssueMemberActivationLinkUseCase(s.events, s.accounts, s.clock)
  })

  it("lets an Owner reissue a Pending member's link, replacing the old one", async () => {
    const link = await issueLink.execute({ actor: as.organizer, eventId: s.event.id, userId: 13 })

    expect(link).toEqual({
      activationToken: 'token-1',
      expiresAt: new Date('2026-10-06T12:00:00.000Z'),
    })
    expect(s.accounts.links.get(13)).toBe('token-1')
  })

  it('refuses an active member with USER_ALREADY_ACTIVE', async () => {
    await expect(
      issueLink.execute({ actor: as.primary, eventId: s.event.id, userId: 12 }),
    ).rejects.toEqual(new AppError('USER_ALREADY_ACTIVE'))
  })

  it('refuses an Owner on an Archived event with EVENT_ARCHIVED', async () => {
    const event = await s.events.findById(s.event.id)
    event?.archive({ by: 10, at: new Date('2026-09-30T12:00:00.000Z') })

    await expect(
      issueLink.execute({ actor: as.primary, eventId: s.event.id, userId: 13 }),
    ).rejects.toEqual(new AppError('EVENT_ARCHIVED'))
    expect(s.accounts.links.get(13)).toBe('old-link')
  })

  it('refuses a Manager with FORBIDDEN', async () => {
    await expect(
      issueLink.execute({ actor: as.manager, eventId: s.event.id, userId: 13 }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('refuses a User who is not a member of this Event with MEMBER_NOT_FOUND', async () => {
    s.users.add({ id: 14, isPending: true })
    await expect(
      issueLink.execute({ actor: as.primary, eventId: s.event.id, userId: 14 }),
    ).rejects.toEqual(new AppError('MEMBER_NOT_FOUND'))
  })
})
