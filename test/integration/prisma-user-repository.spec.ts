import { describe, expect, it } from 'vitest'
import { PrismaUserRepository } from '../../src/modules/identity/infrastructure/prisma-user.repository.js'
import { AppError } from '../../src/shared/domain/app-error.js'
import { Email } from '../../src/shared/domain/email.vo.js'
import { testPrisma } from './support/database.js'
import { createUser } from './support/factories.js'

// The webhook's race (another User takes the email between the check and the
// write) depends on how the pg driver adapter reports the unique violation.
describe('PrismaUserRepository.save', () => {
  const users = new PrismaUserRepository(testPrisma())

  it('refuses an email another User already has with EMAIL_ALREADY_IN_USE', async () => {
    await createUser({ email: 'first@example.com' })
    const second = await createUser({ name: 'Second', email: 'second@example.com' })
    const user = (await users.findById(second.id))!
    user.mirrorProfile({ email: Email.create('first@example.com') }, { by: null, at: new Date() })

    await expect(users.save(user)).rejects.toEqual(new AppError('EMAIL_ALREADY_IN_USE'))
    const row = await testPrisma().user.findUniqueOrThrow({ where: { id: second.id } })
    expect(row.email).toBe('second@example.com')
  })
})
