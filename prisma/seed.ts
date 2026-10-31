// `prisma db seed`: local Super admin. To sign in as them, invite
// admin@local.test from the dashboard of the Clerk development instance.
import 'dotenv/config'
import { createSuperAdmin } from '../scripts/create-super-admin.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL não definida')

const result = await createSuperAdmin(databaseUrl, {
  email: 'admin@local.test',
  name: 'Super admin local',
})
console.log(`Seed: Super admin ${result.user.email.value} (${result.outcome}).`)
