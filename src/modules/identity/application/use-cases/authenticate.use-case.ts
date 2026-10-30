import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { AuthVerifier } from '../ports/auth-verifier.js'

export interface AuthenticateInput {
  /** The session token from `Authorization: Bearer`. */
  token: string
}

/**
 * Resolves the User behind a Clerk session token (ADR-0020). The link between
 * the Clerk user and the User is born here and nowhere else: the first sign-in
 * of an unknown Clerk user takes the User with its verified email. There is no
 * open sign-up, so an email of no User is refused.
 */
export class AuthenticateUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly verifier: AuthVerifier,
    private readonly clock: Clock,
  ) {}

  async execute(input: AuthenticateInput): Promise<User> {
    const identity = await this.verifier.verify(input.token)
    if (!identity) throw new AppError('UNAUTHENTICATED')

    const linked = await this.users.findByClerkId(identity.externalId)
    if (linked) return linked

    const user = await this.users.findByEmail(toEmail(identity.email))
    if (!user) throw new AppError('USER_NOT_INVITED')
    user.linkToClerk(identity.externalId, { by: user.id, at: this.clock.now() })
    await this.users.save(user)
    return user
  }
}

function toEmail(raw: string): Email {
  try {
    return Email.create(raw)
  } catch {
    throw new AppError('UNAUTHENTICATED')
  }
}
