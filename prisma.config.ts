import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` and `prisma validate` run without a database (CI, postinstall).
    url: process.env.DATABASE_URL ?? '',
    // Only needed by `migrate diff --from-migrations` (CI drift check).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
