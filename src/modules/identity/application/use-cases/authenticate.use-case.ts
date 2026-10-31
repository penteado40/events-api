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

/** The User the request runs as. */
export type AuthenticateOutput = User

/**
 * Resolves the User behind a Clerk session token (ADR-0020). The link between
 * the Clerk user and the User is born here and nowhere else: the first sign-in
 * of an unknown Clerk user takes the User with its verified email. There is no
 * open sign-up, so an email of no User is refused. A Deactivated user is
 * refused on every request, since Clerk's ban is not used (ADR-0020).
 */
export class AuthenticateUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly verifier: AuthVerifier,
    private readonly clock: Clock,
  ) {}

  async execute(input: AuthenticateInput): Promise<AuthenticateOutput> {
    const identity = await this.verifier.verify(input.token)
    if (!identity) throw new AppError('UNAUTHENTICATED')

    const linked = await this.users.findByClerkId(identity.externalId)
    if (linked) return notDeactivated(linked)

    const user = await this.users.findByEmail(toEmail(identity.email))
    if (!user) throw new AppError('USER_NOT_INVITED')
    // Linked to another Clerk user: the link is never taken over.
    if (user.isLinkedToClerk) throw new AppError('UNAUTHENTICATED')
    notDeactivated(user)
    user.linkToClerk(identity.externalId, { by: user.id, at: this.clock.now() })
    if (await this.users.saveClerkLink(user)) return user

    // Another request linked the User first: fine only if it was this same Clerk user.
    const winner = await this.users.findByClerkId(identity.externalId)
    if (winner?.id === user.id) return notDeactivated(winner)
    throw new AppError('UNAUTHENTICATED')
  }
}

function notDeactivated(user: User): User {
  if (user.isDeactivated) throw new AppError('USER_DEACTIVATED')
  return user
}

function toEmail(raw: string): Email {
  try {
    return Email.create(raw)
  } catch {
    throw new AppError('UNAUTHENTICATED')
  }
}
