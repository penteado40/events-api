import { PrismaService } from '../../../src/shared/infrastructure/prisma.service.js'
import { loadTestEnv } from './env.js'

let prisma: PrismaService | undefined

/** Direct database access for arranging state in tests. */
export function testPrisma(): PrismaService {
  prisma ??= new PrismaService(loadTestEnv().databaseUrl)
  return prisma
}

/** Empties every application table (read from pg_tables) and resets sequences. */
export async function truncateAllTables(): Promise<void> {
  const db = testPrisma()
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (rows.length === 0) return
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`)
}
