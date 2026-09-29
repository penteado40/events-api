import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { PasswordPolicy } from '../../domain/password-policy.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { PasswordHasher } from '../ports/password-hasher.js'
import type { TokenIssuer } from '../ports/token-issuer.js'

export interface ChangePasswordInput {
  user: User
  currentPassword: string
  newPassword: string
}

export interface ChangePasswordOutput {
  token: string
  expiresIn: number
  user: User
}

/**
 * A User changes their own password. Every session issued before the change is
 * revoked; the returned one keeps the current device logged in.
 */
export class ChangePasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: TokenIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(input: ChangePasswordInput): Promise<ChangePasswordOutput> {
    const { user } = input
    if (!(await this.hasher.compare(input.currentPassword, user.passwordHash))) {
      throw new AppError('INVALID_CURRENT_PASSWORD')
    }
    if (!PasswordPolicy.isStrong(input.newPassword)) throw new AppError('WEAK_PASSWORD')

    user.changePassword(await this.hasher.hash(input.newPassword), {
      by: user.id,
      at: this.clock.now(),
    })
    await this.users.save(user)
    const { token, expiresIn } = await this.sessions.issue(user)
    return { token, expiresIn, user }
  }
}
