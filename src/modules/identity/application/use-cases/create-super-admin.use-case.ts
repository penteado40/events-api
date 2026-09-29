import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { PasswordPolicy } from '../../domain/password-policy.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { PasswordHasher } from '../ports/password-hasher.js'

export interface CreateSuperAdminInput {
  email: string
  name: string
  password: string
  /** Overwrites the password of an existing User (and revokes their sessions). */
  resetPassword?: boolean
}

export interface CreateSuperAdminOutput {
  outcome: 'created' | 'promoted' | 'unchanged'
  passwordReset: boolean
  user: User
}

/**
 * Idempotent: creates the User as Super admin, or promotes an existing one
 * without touching the password unless `resetPassword` is set. Refuses a
 * Pending user: nobody else sets their password. Runs from a platform script,
 * so its writes have no Author (ADR-0013).
 */
export class CreateSuperAdminUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateSuperAdminInput): Promise<CreateSuperAdminOutput> {
    if (!PasswordPolicy.isStrong(input.password)) throw new AppError('WEAK_PASSWORD')
    const email = Email.create(input.email)
    const existing = await this.users.findByEmail(email)
    const stamp = { by: null, at: this.clock.now() }

    if (!existing) {
      const user = await this.users.create(
        {
          name: input.name,
          email,
          passwordHash: await this.hasher.hash(input.password),
          role: 'SUPER_ADMIN',
        },
        stamp,
      )
      return { outcome: 'created', passwordReset: false, user }
    }

    if (existing.isPending) throw new AppError('USER_PENDING')

    const promote = !existing.isSuperAdmin
    const passwordReset = input.resetPassword === true
    if (promote) existing.promoteToSuperAdmin(stamp)
    if (passwordReset) existing.changePassword(await this.hasher.hash(input.password), stamp)
    if (promote || passwordReset) await this.users.save(existing)

    return { outcome: promote ? 'promoted' : 'unchanged', passwordReset, user: existing }
  }
}
