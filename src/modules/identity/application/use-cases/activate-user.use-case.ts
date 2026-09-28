import { AppError } from '../../../../shared/domain/app-error.js'
import type { ActivationLinkRepository } from '../../domain/activation-link.repository.js'
import { PasswordPolicy } from '../../domain/password-policy.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { ActivationTokenGenerator } from '../ports/activation-token-generator.js'
import type { PasswordHasher } from '../ports/password-hasher.js'
import type { TokenIssuer } from '../ports/token-issuer.js'

export interface ActivateUserInput {
  token: string
  password: string
}

export interface ActivateUserOutput {
  token: string
  expiresIn: number
  user: User
}

export interface ActivateUserOptions {
  now?: () => Date
}

/**
 * A Pending user sets their own password through the Activation link and gets
 * a session. Checks run in order: link exists, unused, unexpired, then the
 * password; nothing changes until all pass.
 */
export class ActivateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly tokens: ActivationTokenGenerator,
    private readonly hasher: PasswordHasher,
    private readonly sessions: TokenIssuer,
    private readonly options: ActivateUserOptions = {},
  ) {}

  async execute(input: ActivateUserInput): Promise<ActivateUserOutput> {
    const now = this.options.now?.() ?? new Date()
    const link = await this.links.findByTokenHash(this.tokens.hash(input.token))
    if (!link) throw new AppError('ACTIVATION_LINK_INVALID')
    if (link.isUsed) throw new AppError('ACTIVATION_LINK_USED')
    if (link.isExpired(now)) throw new AppError('ACTIVATION_LINK_EXPIRED')
    if (!PasswordPolicy.isStrong(input.password)) throw new AppError('WEAK_PASSWORD')

    const user = await this.users.findById(link.userId)
    if (!user) throw new AppError('ACTIVATION_LINK_INVALID')
    // Activated some other way (e.g. the create-super-admin script): the link is spent.
    if (!user.isPending) throw new AppError('ACTIVATION_LINK_USED')

    user.activate(await this.hasher.hash(input.password), now)
    if (!(await this.links.completeActivation(link, user, now))) {
      throw new AppError('ACTIVATION_LINK_USED')
    }
    const { token, expiresIn } = await this.sessions.issue(user)
    return { token, expiresIn, user }
  }
}
