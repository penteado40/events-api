/**
 * Creates the Super admin, or promotes an existing User. Idempotent.
 *
 *   npm run create-super-admin -- --email=a@b.com --name="Ana"
 *
 * Each option can also come from ADMIN_EMAIL and ADMIN_NAME. Only the local
 * User: the person enters Clerk through an invitation to the same email, sent
 * from the Clerk dashboard (docs/infra.md), and their first sign-in links it.
 */
import { parseArgs } from 'node:util'
import {
  type CreateSuperAdminInput,
  CreateSuperAdminUseCase,
} from '../src/modules/identity/application/use-cases/create-super-admin.use-case.js'
import { PrismaUserRepository } from '../src/modules/identity/infrastructure/prisma-user.repository.js'
import { AppError } from '../src/shared/domain/app-error.js'
import { PrismaService } from '../src/shared/infrastructure/prisma.service.js'
import { SystemClock } from '../src/shared/infrastructure/system-clock.js'

export async function createSuperAdmin(databaseUrl: string, input: CreateSuperAdminInput) {
  const prisma = new PrismaService(databaseUrl)
  try {
    const useCase = new CreateSuperAdminUseCase(new PrismaUserRepository(prisma), new SystemClock())
    return await useCase.execute(input)
  } finally {
    await prisma.$disconnect()
  }
}

const REFUSAL: Partial<Record<string, string>> = {
  VALIDATION_ERROR: 'email inválido.',
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
    },
  })
  const email = values.email ?? process.env.ADMIN_EMAIL
  const name = values.name ?? process.env.ADMIN_NAME
  const databaseUrl = process.env.DATABASE_URL
  if (!email || !name || !databaseUrl) {
    console.error('Informe email e name (args ou ADMIN_*) e DATABASE_URL.')
    process.exit(1)
  }

  try {
    const result = await createSuperAdmin(databaseUrl, { email, name })
    const pending = result.user.isPending ? '; entra pelo convite do Clerk' : ''
    console.log(`Super admin ${result.user.email.value}: ${result.outcome}${pending}.`)
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`Recusado (${error.code}): ${REFUSAL[error.code] ?? 'dados inválidos.'}`)
      process.exit(1)
    }
    throw error
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
