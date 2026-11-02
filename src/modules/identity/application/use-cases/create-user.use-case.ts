import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { Phone } from '../../../../shared/domain/phone.vo.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { ActivationLinks, UserWithActivationLink } from '../activation-links.js'
import { type ActivationLinkMailer, recipientOf } from '../ports/activation-link-mailer.js'

export interface CreateUserInput {
  actor: User
  name: string
  email: string
  phone: string
}

export type CreateUserOutput = UserWithActivationLink

/**
 * The Super admin creates a Pending user, who activates through the link that
 * goes back in the response and by email to the Pending user.
 */
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly activationLinks: ActivationLinks,
    private readonly mailer: ActivationLinkMailer,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    if (!input.actor.isSuperAdmin) throw new AppError('FORBIDDEN')
    const email = Email.create(input.email)
    const phone = Phone.create(input.phone)
    if (await this.users.findByEmail(email)) throw new AppError('EMAIL_ALREADY_IN_USE')

    const stamp = { by: input.actor.id, at: this.clock.now() }
    const created = await this.activationLinks.createPendingUser(
      { name: input.name, email, phone },
      stamp,
    )
    // Only once the User and the link are stored, so no email goes out for a User that failed.
    this.mailer.send(recipientOf(created.user), created.activationLink, stamp)
    return created
  }
}
