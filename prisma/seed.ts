// `prisma db seed`: local Super admin. In production the real one arrives with
// the migration (PROJ-68); `create-super-admin` is only a fallback there.
import 'dotenv/config'
import { createSuperAdmin } from '../scripts/create-super-admin.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL não definida')

const result = await createSuperAdmin(databaseUrl, {
  email: 'admin@local.test',
  name: 'Super admin local',
  password: 'Admin-local-123',
})
console.log(`Seed: Super admin ${result.user.email.value} (${result.outcome}).`)
