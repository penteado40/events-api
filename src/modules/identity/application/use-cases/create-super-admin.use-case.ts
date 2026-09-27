import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
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

export interface CreateSuperAdminOptions {
  minPasswordLength?: number
}

/**
 * Idempotent: creates the User as Super admin, or promotes an existing one
 * without touching the password unless `resetPassword` is set.
 */
export class CreateSuperAdminUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly options: CreateSuperAdminOptions = {},
  ) {}

  async execute(input: CreateSuperAdminInput): Promise<CreateSuperAdminOutput> {
    if (input.password.length < (this.options.minPasswordLength ?? 0)) {
      throw new AppError('VALIDATION_ERROR')
    }
    const email = Email.create(input.email)
    const existing = await this.users.findByEmail(email)

    if (!existing) {
      const user = await this.users.create({
        name: input.name,
        email,
        passwordHash: await this.hasher.hash(input.password),
        role: 'SUPER_ADMIN',
      })
      return { outcome: 'created', passwordReset: false, user }
    }

    const promote = !existing.isSuperAdmin
    const passwordReset = input.resetPassword === true
    if (promote) existing.promoteToSuperAdmin()
    if (passwordReset) existing.changePassword(await this.hasher.hash(input.password))
    if (promote || passwordReset) await this.users.save(existing)

    return { outcome: promote ? 'promoted' : 'unchanged', passwordReset, user: existing }
  }
}
