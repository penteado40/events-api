import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { Phone } from '../../../../shared/domain/phone.vo.js'
import type { User } from '../../domain/user.entity.js'
import { SCRIPT_STAMP, signedIn } from '../testing/identity-fixtures.js'
import { FakeGroupMembers } from '../testing/fake-group-members.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { UpdateMeUseCase } from './update-me.use-case.js'

const NOW = new Date('2026-10-31T12:00:00.000Z')

describe('UpdateMeUseCase', () => {
  let users: InMemoryUserRepository
  let groupMembers: FakeGroupMembers
  let updateMe: UpdateMeUseCase
  let ana: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    groupMembers = new FakeGroupMembers()
    updateMe = new UpdateMeUseCase(users, groupMembers, new FixedClock(NOW))
    ana = await signedIn(
      users,
      await users.create(
        {
          name: 'Ana',
          email: Email.create('ana@example.com'),
          phone: Phone.create('+5511900000001'),
          role: 'USER',
        },
        SCRIPT_STAMP,
      ),
    )
  })

  it('changes the name and the phone, stored normalized, authored by the User', async () => {
    const { user } = await updateMe.execute({
      actor: ana,
      name: '  Ana Souza  ',
      phone: '+55 (21) 98765-4321',
    })

    expect(user.name).toBe('Ana Souza')
    expect(user.phone.value).toBe('+5521987654321')
    const stored = await users.findById(ana.id)
    expect(stored?.name).toBe('Ana Souza')
    expect(stored?.phone.value).toBe('+5521987654321')
    expect(stored?.updatedAt).toEqual(NOW)
    expect(stored?.updatedById).toBe(ana.id)
  })

  it('keeps what the request leaves out', async () => {
    const { user } = await updateMe.execute({ actor: ana, phone: '+5521987654321' })

    expect(user.name).toBe('Ana')
    expect(user.phone.value).toBe('+5521987654321')
  })

  it('answers as GET /me does, with the Membership', async () => {
    groupMembers.set(ana.id, [{ groupId: 1, groupName: 'Vocal Livre', role: 'VIEWER' }])

    const me = await updateMe.execute({ actor: ana, name: 'Ana Souza' })

    expect(me).toEqual({
      user: ana,
      isSuperAdmin: false,
      memberships: [{ groupId: 1, groupName: 'Vocal Livre', role: 'VIEWER' }],
    })
  })

  it('refuses an invalid phone with VALIDATION_ERROR, changing nothing', async () => {
    await expect(
      updateMe.execute({ actor: ana, name: 'Ana Souza', phone: '98765-4321' }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))

    const stored = await users.findById(ana.id)
    expect(stored?.name).toBe('Ana')
    expect(stored?.phone.value).toBe('+5511900000001')
    expect(stored?.updatedById).toBe(ana.id)
    expect(stored?.updatedAt).toEqual(SCRIPT_STAMP.at)
  })
})
