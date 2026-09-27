/**
 * Creates the Super admin, or promotes an existing User. Idempotent.
 *
 *   npm run create-super-admin -- --email=a@b.com --name="Ana" --password=... [--reset-password]
 *
 * Each option can also come from ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD.
 * In production the password needs at least 12 characters.
 */
import { parseArgs } from 'node:util'
import {
  type CreateSuperAdminInput,
  CreateSuperAdminUseCase,
} from '../src/modules/identity/application/use-cases/create-super-admin.use-case.js'
import { BcryptPasswordHasher } from '../src/modules/identity/infrastructure/bcrypt-password-hasher.js'
import { PrismaUserRepository } from '../src/modules/identity/infrastructure/prisma-user.repository.js'
import { AppError } from '../src/shared/domain/app-error.js'
import { PrismaService } from '../src/shared/infrastructure/prisma.service.js'

export async function createSuperAdmin(databaseUrl: string, input: CreateSuperAdminInput) {
  const prisma = new PrismaService(databaseUrl)
  try {
    const useCase = new CreateSuperAdminUseCase(
      new PrismaUserRepository(prisma),
      new BcryptPasswordHasher(),
      { enforceStrongPassword: process.env.NODE_ENV === 'production' },
    )
    return await useCase.execute(input)
  } finally {
    await prisma.$disconnect()
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
      'reset-password': { type: 'boolean', default: false },
    },
  })
  const email = values.email ?? process.env.ADMIN_EMAIL
  const name = values.name ?? process.env.ADMIN_NAME
  const password = values.password ?? process.env.ADMIN_PASSWORD
  const databaseUrl = process.env.DATABASE_URL
  if (!email || !name || !password || !databaseUrl) {
    console.error('Informe email, name e password (args ou ADMIN_*) e DATABASE_URL.')
    process.exit(1)
  }

  try {
    const result = await createSuperAdmin(databaseUrl, {
      email,
      name,
      password,
      resetPassword: values['reset-password'],
    })
    const reset = result.passwordReset ? ', senha redefinida' : ''
    console.log(`Super admin ${result.user.email.value}: ${result.outcome}${reset}.`)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`Recusado (${error.code}): email inválido ou senha curta demais.`)
      process.exit(1)
    }
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
