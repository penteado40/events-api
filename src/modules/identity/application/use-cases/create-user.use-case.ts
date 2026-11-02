import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { Phone } from '../../../../shared/domain/phone.vo.js'
import type { ActivationLinkRepository } from '../../domain/activation-link.repository.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import { createPendingUser, type IssuedActivationLink } from '../issue-activation-link.js'
import type { ActivationLinkMailer } from '../ports/activation-link-mailer.js'
import type { InvitationIssuer } from '../ports/invitation-issuer.js'

export interface CreateUserInput {
  actor: User
  name: string
  email: string
  phone: string
}

export interface CreateUserOutput {
  user: User
  activationLink: IssuedActivationLink
}

/**
 * The Super admin creates a Pending user, who activates through the link that
 * goes back in the response and by email to the Pending user.
 */
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly invitations: InvitationIssuer,
    private readonly mailer: ActivationLinkMailer,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    if (!input.actor.isSuperAdmin) throw new AppError('FORBIDDEN')
    const email = Email.create(input.email)
    const phone = Phone.create(input.phone)
    if (await this.users.findByEmail(email)) throw new AppError('EMAIL_ALREADY_IN_USE')

    const stamp = { by: input.actor.id, at: this.clock.now() }
    const created = await createPendingUser(
      this.users,
      this.links,
      this.invitations,
      { name: input.name, email, phone },
      stamp,
    )
    // Only once the User and the link are stored (ADR-0010: after the commit).
    this.mailer.send(
      { email: created.user.email.value, name: created.user.name },
      created.activationLink,
      stamp,
    )
    return created
  }
}
