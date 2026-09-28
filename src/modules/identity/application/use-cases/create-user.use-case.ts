import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { ActivationLinkRepository } from '../../domain/activation-link.repository.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import {
  type ActivationLinkOptions,
  type IssuedActivationLink,
  issueActivationLink,
} from '../issue-activation-link.js'
import type { ActivationTokenGenerator } from '../ports/activation-token-generator.js'

export interface CreateUserInput {
  actor: User
  name: string
  email: string
}

export interface CreateUserOutput extends IssuedActivationLink {
  user: User
}

/** The Super admin creates a Pending user, who activates through the returned link. */
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly tokens: ActivationTokenGenerator,
    private readonly options: ActivationLinkOptions,
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    if (!input.actor.isSuperAdmin) throw new AppError('FORBIDDEN')
    const email = Email.create(input.email)
    if (await this.users.findByEmail(email)) throw new AppError('EMAIL_ALREADY_IN_USE')

    const user = await this.users.create({
      name: input.name.trim(),
      email,
      passwordHash: null,
      role: 'USER',
    })
    const link = await issueActivationLink(this.links, this.tokens, user.id, this.options)
    return { user, ...link }
  }
}
