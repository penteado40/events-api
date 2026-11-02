import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import { ActivationLinks } from '../activation-links.js'
import { FakeActivationLinkMailer } from '../testing/fake-activation-link-mailer.js'
import { FakeInvitationIssuer } from '../testing/fake-invitation-issuer.js'
import { SCRIPT_STAMP, PHONE } from '../testing/identity-fixtures.js'
import { InMemoryActivationLinkRepository } from '../testing/in-memory-activation-link.repository.js'
import { InMemoryUserRepository } from '../testing/in-memory-user.repository.js'
import { CreateUserUseCase } from './create-user.use-case.js'

const NOW = new Date('2026-09-28T12:00:00.000Z')

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository
  let links: InMemoryActivationLinkRepository
  let invitations: FakeInvitationIssuer
  let mailer: FakeActivationLinkMailer
  let createUser: CreateUserUseCase
  let superAdmin: User

  beforeEach(async () => {
    users = new InMemoryUserRepository()
    links = new InMemoryActivationLinkRepository()
    const clock = new FixedClock(NOW)
    invitations = new FakeInvitationIssuer(clock)
    mailer = new FakeActivationLinkMailer()
    createUser = new CreateUserUseCase(
      users,
      new ActivationLinks(users, links, invitations),
      mailer,
      clock,
    )
    superAdmin = await users.create(
      {
        name: 'Admin',
        email: Email.create('admin@example.com'),
        phone: PHONE,
        role: 'SUPER_ADMIN',
      },
      SCRIPT_STAMP,
    )
  })

  it('creates a Pending user with an Activation link valid for the TTL', async () => {
    const result = await createUser.execute({
      actor: superAdmin,
      name: '  Pedro  ',
      email: ' Pedro@Example.com ',
      phone: '+55 (11) 98765-4321',
    })

    expect(result.user.name).toBe('Pedro')
    expect(result.user.email.value).toBe('pedro@example.com')
    expect(result.user.phone.value).toBe('+5511987654321')
    expect(result.user.role).toBe('USER')
    expect(result.user.isPending).toBe(true)
    expect(result.activationLink).toEqual({
      url: 'https://accounts.clerk.test/accept?invitation=inv_1',
      expiresAt: new Date('2026-10-05T12:00:00.000Z'),
    })
    expect(links.all()).toHaveLength(1)
    expect(links.all()[0]?.userId).toBe(result.user.id)
    expect(links.all()[0]?.invitationId).toBe('inv_1')
  })

  it('emails the Activation link to the Pending user, by the Super admin', async () => {
    const result = await createUser.execute({
      actor: superAdmin,
      name: 'Pedro',
      email: 'pedro@example.com',
      phone: '+5511987654321',
    })

    expect(mailer.sent).toEqual([
      {
        to: { email: 'pedro@example.com', name: 'Pedro' },
        link: result.activationLink,
        stamp: { by: superAdmin.id, at: NOW },
      },
    ])
  })

  it('records the Super admin as the Author of the User and of the Activation link', async () => {
    const { user } = await createUser.execute({
      actor: superAdmin,
      name: 'Pedro',
      email: 'pedro@example.com',
      phone: '+5511987654321',
    })

    expect(user.createdById).toBe(1)
    expect(user.updatedById).toBe(1)
    expect(user.createdAt).toEqual(NOW)
    expect(user.updatedAt).toEqual(NOW)
    expect(links.all()[0]?.createdById).toBe(1)
    expect(links.all()[0]?.createdAt).toEqual(NOW)
  })

  it('refuses an actor who is not the Super admin with FORBIDDEN', async () => {
    const ana = await users.create(
      {
        name: 'Ana',
        email: Email.create('ana@example.com'),
        phone: PHONE,
        role: 'USER',
      },
      SCRIPT_STAMP,
    )

    await expect(
      createUser.execute({
        actor: ana,
        name: 'Pedro',
        email: 'pedro@example.com',
        phone: '+5511987654321',
      }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(users.all()).toHaveLength(2)
  })

  it('refuses an email that already has a User with EMAIL_ALREADY_IN_USE, ignoring case', async () => {
    await expect(
      createUser.execute({
        actor: superAdmin,
        name: 'Other',
        email: 'ADMIN@example.com',
        phone: '+5511987654321',
      }),
    ).rejects.toEqual(new AppError('EMAIL_ALREADY_IN_USE'))
    expect(links.all()).toHaveLength(0)
    expect(invitations.open()).toEqual([])
  })

  it('creates no User when the invitation fails', async () => {
    invitations.failNextIssue()

    await expect(
      createUser.execute({
        actor: superAdmin,
        name: 'Pedro',
        email: 'pedro@example.com',
        phone: '+5511987654321',
      }),
    ).rejects.toThrow()
    expect(users.all()).toHaveLength(1)
    expect(links.all()).toHaveLength(0)
    expect(mailer.sent).toEqual([])
  })

  it('answers EMAIL_ALREADY_IN_USE when another request created the email meanwhile, revoking the invitation', async () => {
    users.createConcurrently({
      name: 'Winner',
      email: Email.create('pedro@example.com'),
      phone: PHONE,
      role: 'USER',
    })

    await expect(
      createUser.execute({
        actor: superAdmin,
        name: 'Pedro',
        email: 'pedro@example.com',
        phone: '+5511987654321',
      }),
    ).rejects.toEqual(new AppError('EMAIL_ALREADY_IN_USE'))
    expect(invitations.open()).toEqual([])
    expect(mailer.sent).toEqual([])
  })

  it('refuses a malformed email with VALIDATION_ERROR', async () => {
    await expect(
      createUser.execute({
        actor: superAdmin,
        name: 'Pedro',
        email: 'not-an-email',
        phone: '+5511987654321',
      }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })

  it('refuses a phone without the country code with VALIDATION_ERROR, creating nothing', async () => {
    await expect(
      createUser.execute({
        actor: superAdmin,
        name: 'Pedro',
        email: 'pedro@example.com',
        phone: '11 98765-4321',
      }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    expect(users.all()).toHaveLength(1)
    expect(links.all()).toHaveLength(0)
  })
})
