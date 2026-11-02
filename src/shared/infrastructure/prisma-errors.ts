import { Prisma } from '../../generated/prisma/client.js'

/**
 * A unique violation (P2002); with `index`, only one on that unique index, as
 * the pg driver adapter reports it (e.g. `users_email_key`).
 */
export function isUniqueViolation(error: unknown, index?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  if (index === undefined) return true
  const adapterError = error.meta?.['driverAdapterError'] as
    { cause?: { constraint?: { index?: unknown } } } | undefined
  return adapterError?.cause?.constraint?.index === index
}
