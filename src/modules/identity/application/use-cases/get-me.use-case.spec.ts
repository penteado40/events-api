import { beforeEach, describe, expect, it } from 'vitest'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { Role, User } from '../../domain/user.entity.js'
import { PHONE, SCRIPT_STAMP, signedIn } from '../testing/identity-fixtures.js'
import { FakeEventParticipations } from '../testing/fake-event-participations.js'
import { FakeGroupMembers } from '../testing/fake-group-members.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { GetMeUseCase } from './get-me.use-case.js'

describe('GetMeUseCase', () => {
  let users: InMemoryUserRepository
  let groupMembers: FakeGroupMembers
  let participations: FakeEventParticipations
  let getMe: GetMeUseCase

  beforeEach(() => {
    users = new InMemoryUserRepository()
    groupMembers = new FakeGroupMembers()
    participations = new FakeEventParticipations()
    getMe = new GetMeUseCase(groupMembers, participations)
  })

  async function aUser(role: Role): Promise<User> {
    const user = await users.create(
      { name: 'Ana', email: Email.create('ana@example.com'), phone: PHONE, role },
      SCRIPT_STAMP,
    )
    return signedIn(users, user)
  }

  it('brings the Groups of the User, with the role in each', async () => {
    const ana = await aUser('USER')
    groupMembers.set(ana.id, [
      { groupId: 1, groupName: 'Vocal Livre', role: 'OWNER' },
      { groupId: 2, groupName: 'Coral Jovem', role: 'VIEWER' },
    ])

    const me = await getMe.execute({ actor: ana })

    expect(me).toEqual({
      user: ana,
      isSuperAdmin: false,
      memberships: [
        { groupId: 1, groupName: 'Vocal Livre', role: 'OWNER', participantEventIds: [] },
        { groupId: 2, groupName: 'Coral Jovem', role: 'VIEWER', participantEventIds: [] },
      ],
    })
  })

  it('says, in each Group, the Events the User is a Participant of', async () => {
    const ana = await aUser('USER')
    groupMembers.set(ana.id, [
      { groupId: 1, groupName: 'Vocal Livre', role: 'VIEWER' },
      { groupId: 2, groupName: 'Coral Jovem', role: 'OWNER' },
    ])
    participations.set(ana.id, [
      { groupId: 1, eventId: 10 },
      { groupId: 2, eventId: 11 },
      { groupId: 1, eventId: 12 },
      // A Group she is no longer a Group member of stays out of her Membership.
      { groupId: 3, eventId: 13 },
    ])

    const me = await getMe.execute({ actor: ana })

    expect(me.memberships).toEqual([
      { groupId: 1, groupName: 'Vocal Livre', role: 'VIEWER', participantEventIds: [10, 12] },
      { groupId: 2, groupName: 'Coral Jovem', role: 'OWNER', participantEventIds: [11] },
    ])
  })

  it('answers no Membership for a User of no Group', async () => {
    const ana = await aUser('USER')

    const me = await getMe.execute({ actor: ana })

    expect(me.isSuperAdmin).toBe(false)
    expect(me.memberships).toEqual([])
  })

  it('marks the Super admin, who has no Membership', async () => {
    const admin = await aUser('SUPER_ADMIN')
    groupMembers.set(admin.id, [{ groupId: 1, groupName: 'Vocal Livre', role: 'OWNER' }])

    const me = await getMe.execute({ actor: admin })

    expect(me).toEqual({ user: admin, isSuperAdmin: true, memberships: [] })
  })
})
