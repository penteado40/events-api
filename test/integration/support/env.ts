/** Loads `.env` when present (CI passes the variables directly). */
export function loadTestEnv(): { databaseUrl: string } {
  try {
    process.loadEnvFile('.env')
  } catch {
    // no .env: rely on the environment
  }
  const databaseUrl = process.env.DATABASE_URL_TEST
  if (!databaseUrl) throw new Error('DATABASE_URL_TEST não definida (veja .env.example)')
  return { databaseUrl }
}
