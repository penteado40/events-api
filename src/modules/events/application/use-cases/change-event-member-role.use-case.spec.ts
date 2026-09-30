import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { as, MEMBER_NOW, memberRows, memberScenario } from '../testing/member-fixtures.js'
import { ChangeEventMemberRoleUseCase } from './change-event-member-role.use-case.js'

describe('ChangeEventMemberRoleUseCase', () => {
  let s: Awaited<ReturnType<typeof memberScenario>>
  let changeRole: ChangeEventMemberRoleUseCase

  beforeEach(async () => {
    s = await memberScenario()
    changeRole = new ChangeEventMemberRoleUseCase(s.events, s.users, s.clock)
  })

  it('changes the role, recording the Author on the link', async () => {
    const result = await changeRole.execute({
      actor: as.organizer,
      eventId: s.event.id,
      userId: 13,
      role: 'MANAGER',
    })

    expect([result.member.role, result.user.id]).toEqual(['MANAGER', 13])
    const stored = await s.events.findMember(s.event.id, 13)
    expect([stored?.role, stored?.updatedById, stored?.updatedAt]).toEqual([
      'MANAGER',
      11,
      MEMBER_NOW,
    ])
  })

  it('accepts the role the member already has, without a new Author', async () => {
    await changeRole.execute({
      actor: as.organizer,
      eventId: s.event.id,
      userId: 12,
      role: 'MANAGER',
    })

    expect((await s.events.findMember(s.event.id, 12))?.updatedById).toBe(1)
  })

  it('lets the Primary owner demote another Owner', async () => {
    await changeRole.execute({ actor: as.primary, eventId: s.event.id, userId: 11, role: 'VIEWER' })

    expect(await memberRows(s.events, s.event.id)).toContainEqual([11, 'VIEWER', false])
  })

  it('refuses an Owner organizador demoting another Owner with FORBIDDEN', async () => {
    await expect(
      changeRole.execute({ actor: as.organizer, eventId: s.event.id, userId: 10, role: 'VIEWER' }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('keeps the Primary owner from demoting themselves before transferring', async () => {
    await expect(
      changeRole.execute({ actor: as.primary, eventId: s.event.id, userId: 10, role: 'MANAGER' }),
    ).rejects.toEqual(new AppError('PRIMARY_OWNER_MUST_TRANSFER'))
  })

  it('refuses a Manager with FORBIDDEN', async () => {
    await expect(
      changeRole.execute({ actor: as.manager, eventId: s.event.id, userId: 13, role: 'MANAGER' }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('refuses someone who is not a member with MEMBER_NOT_FOUND', async () => {
    await expect(
      changeRole.execute({ actor: as.primary, eventId: s.event.id, userId: 14, role: 'VIEWER' }),
    ).rejects.toEqual(new AppError('MEMBER_NOT_FOUND'))
  })
})
