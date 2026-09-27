import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()

/** Lints `code` as if it were saved at `filePath` and returns the rule ids that fired. */
async function violations(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? m.message)
}

describe('architecture lint (docs/arquitetura.md §7)', () => {
  it('forbids infrastructure libraries in domain/', async () => {
    const rules = await violations(
      'src/modules/identity/domain/example.ts',
      "import { PrismaClient } from '@prisma/client'\nexport const x = PrismaClient\n",
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it('forbids application/ from importing infrastructure/', async () => {
    const rules = await violations(
      'src/modules/identity/application/example.ts',
      "import { BcryptPasswordHasher } from '../infrastructure/bcrypt-password-hasher.js'\nexport const x = BcryptPasswordHasher\n",
    )

    expect(rules).toContain('boundaries/dependencies')
  })

  it("forbids importing another module's internal files", async () => {
    const rules = await violations(
      'src/modules/events/application/example.ts',
      "import { User } from '../../identity/domain/user.entity.js'\nexport const x = User\n",
    )

    expect(rules).toContain('boundaries/dependencies')
  })

  it("allows importing another module's public API (index.ts)", async () => {
    const rules = await violations(
      'src/modules/events/presentation/example.ts',
      "import { IdentityModule } from '../../identity/index.js'\nexport const x = IdentityModule\n",
    )

    expect(rules).toEqual([])
  })
})
