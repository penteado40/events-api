import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { as, memberScenario } from '../testing/member-fixtures.js'
import { ListEventMembersUseCase } from './list-event-members.use-case.js'

describe('ListEventMembersUseCase', () => {
  let s: Awaited<ReturnType<typeof memberScenario>>
  let listMembers: ListEventMembersUseCase

  beforeEach(async () => {
    s = await memberScenario()
    s.users.add({ id: 13, name: 'Vera', email: 'vera@example.com', isPending: true })
    listMembers = new ListEventMembersUseCase(s.events, s.users)
  })

  it('shows every Event member to any member, with the User behind each link', async () => {
    const result = await listMembers.execute({ actor: as.viewer, eventId: s.event.id })

    expect(
      result.map(({ member, user }) => [
        member.userId,
        member.role,
        member.isPrimaryOwner,
        user.name,
        user.isPending,
      ]),
    ).toEqual([
      [10, 'OWNER', true, 'User 10', false],
      [11, 'OWNER', false, 'User 11', false],
      [12, 'MANAGER', false, 'User 12', false],
      [13, 'VIEWER', false, 'Vera', true],
    ])
  })

  it('lets the Super admin list any Event', async () => {
    const result = await listMembers.execute({ actor: as.superAdmin, eventId: s.event.id })
    expect(result).toHaveLength(4)
  })

  it('refuses a User of no Event with FORBIDDEN', async () => {
    await expect(listMembers.execute({ actor: as.stranger, eventId: s.event.id })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('still lists the members of an Archived event', async () => {
    const event = await s.events.findById(s.event.id)
    event?.archive({ by: 10, at: new Date() })

    const result = await listMembers.execute({ actor: as.manager, eventId: s.event.id })
    expect(result).toHaveLength(4)
  })
})
