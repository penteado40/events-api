import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { PHONE, SCRIPT_STAMP, signedIn } from '../testing/identity-fixtures.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { SyncUserFromClerkUseCase } from './sync-user-from-clerk.use-case.js'

const NOW = new Date('2026-10-31T12:00:00.000Z')

describe('SyncUserFromClerkUseCase', () => {
  let users: InMemoryUserRepository
  let sync: SyncUserFromClerkUseCase
  let ana: User

  async function createUser(name: string, email: string): Promise<User> {
    return users.create(
      { name, email: Email.create(email), phone: PHONE, role: 'USER' },
      SCRIPT_STAMP,
    )
  }

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    sync = new SyncUserFromClerkUseCase(users, new FixedClock(NOW))
    ana = await signedIn(users, await createUser('Ana', 'ana@example.com'))
  })

  it('updates the name and the email of the linked User, with no Author', async () => {
    const outcome = await sync.execute({
      externalId: ana.clerkId!,
      name: 'Ana Souza',
      email: 'Ana.Souza@Example.com',
    })

    expect(outcome).toBe('UPDATED')
    const stored = await users.findById(ana.id)
    expect(stored?.name).toBe('Ana Souza')
    expect(stored?.email.value).toBe('ana.souza@example.com')
    expect(stored?.updatedAt).toEqual(NOW)
    expect(stored?.updatedById).toBeNull()
  })

  it('ignores an unknown Clerk user, creating nothing', async () => {
    const outcome = await sync.execute({
      externalId: 'user_unknown',
      name: 'Bia',
      email: 'bia@example.com',
    })

    expect(outcome).toBe('UNKNOWN_USER')
    expect(users.all()).toHaveLength(1)
    expect(await users.findByEmail(Email.create('bia@example.com'))).toBeNull()
  })

  it('touches nothing when the name and the email did not change', async () => {
    const outcome = await sync.execute({
      externalId: ana.clerkId!,
      name: 'Ana',
      email: 'ana@example.com',
    })

    expect(outcome).toBe('UNCHANGED')
    const stored = await users.findById(ana.id)
    expect(stored?.updatedById).toBe(ana.id)
    expect(stored?.updatedAt).toEqual(SCRIPT_STAMP.at)
  })

  it('keeps the current name when Clerk has none, and the email when it is missing or invalid', async () => {
    for (const email of [null, 'not-an-email']) {
      const outcome = await sync.execute({ externalId: ana.clerkId!, name: '  ', email })

      expect(outcome).toBe('UNCHANGED')
    }
    const stored = await users.findById(ana.id)
    expect(stored?.name).toBe('Ana')
    expect(stored?.email.value).toBe('ana@example.com')
  })

  it('updates only the name when another User has the new email', async () => {
    await createUser('Bia', 'bia@example.com')

    const outcome = await sync.execute({
      externalId: ana.clerkId!,
      name: 'Ana Souza',
      email: 'bia@example.com',
    })

    expect(outcome).toBe('EMAIL_IN_USE')
    const stored = await users.findById(ana.id)
    expect(stored?.name).toBe('Ana Souza')
    expect(stored?.email.value).toBe('ana@example.com')
    expect(stored?.updatedById).toBeNull()
  })

  it('updates only the name when another User takes the new email meanwhile', async () => {
    users.takeEmailConcurrently(Email.create('bia@example.com'))

    const outcome = await sync.execute({
      externalId: ana.clerkId!,
      name: 'Ana Souza',
      email: 'bia@example.com',
    })

    expect(outcome).toBe('EMAIL_IN_USE')
    const stored = await users.findById(ana.id)
    expect(stored?.name).toBe('Ana Souza')
    expect(stored?.email.value).toBe('ana@example.com')
  })
})
