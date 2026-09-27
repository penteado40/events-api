import { execSync } from 'node:child_process'
import { loadTestEnv } from './support/env.js'

export default function globalSetup(): void {
  const { databaseUrl } = loadTestEnv()
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })
}
