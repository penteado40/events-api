import { beforeEach, describe, expect, it } from 'vitest'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { Role, User } from '../../domain/user.entity.js'
import { PHONE, SCRIPT_STAMP, signedIn } from '../testing/identity-fixtures.js'
import { InMemoryMemberships } from '../testing/in-memory-memberships.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { GetMeUseCase } from './get-me.use-case.js'

describe('GetMeUseCase', () => {
  let users: InMemoryUserRepository
  let memberships: InMemoryMemberships
  let getMe: GetMeUseCase

  beforeEach(() => {
    users = new InMemoryUserRepository()
    memberships = new InMemoryMemberships()
    getMe = new GetMeUseCase(memberships)
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
    memberships.set(ana.id, [
      { groupId: 1, groupName: 'Vocal Livre', role: 'OWNER' },
      { groupId: 2, groupName: 'Coral Jovem', role: 'VIEWER' },
    ])

    const me = await getMe.execute({ actor: ana })

    expect(me).toEqual({
      user: ana,
      isSuperAdmin: false,
      memberships: [
        { groupId: 1, groupName: 'Vocal Livre', role: 'OWNER' },
        { groupId: 2, groupName: 'Coral Jovem', role: 'VIEWER' },
      ],
    })
  })

  it('answers no Membership for a User of no Group', async () => {
    const ana = await aUser('USER')

    const me = await getMe.execute({ actor: ana })

    expect(me.isSuperAdmin).toBe(false)
    expect(me.memberships).toEqual([])
  })

  it('marks the Super admin, who has no Membership', async () => {
    const admin = await aUser('SUPER_ADMIN')
    memberships.set(admin.id, [{ groupId: 1, groupName: 'Vocal Livre', role: 'OWNER' }])

    const me = await getMe.execute({ actor: admin })

    expect(me).toEqual({ user: admin, isSuperAdmin: true, memberships: [] })
    expect(memberships.asked).toEqual([])
  })
})
