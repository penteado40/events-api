import { afterAll, beforeAll } from 'vitest'
import { testPrisma, truncateAllTables } from './support/database.js'

beforeAll(async () => {
  await truncateAllTables()
})

afterAll(async () => {
  await testPrisma().$disconnect()
})
