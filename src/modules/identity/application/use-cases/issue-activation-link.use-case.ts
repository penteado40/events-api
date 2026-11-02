import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { User } from '../../domain/user.entity.js'
import type { ActivationLinks, IssuedActivationLink } from '../activation-links.js'
import { type ActivationLinkMailer, recipientOf } from '../ports/activation-link-mailer.js'

export interface IssueActivationLinkInput {
  actor: User
  userId: number
}

export type IssueActivationLinkOutput = IssuedActivationLink

/**
 * Reissues the Activation link of a Pending user (lost or expired link): the
 * new link goes back in the response and by email to the Pending user.
 */
export class IssueActivationLinkUseCase {
  constructor(
    private readonly activationLinks: ActivationLinks,
    private readonly mailer: ActivationLinkMailer,
    private readonly clock: Clock,
  ) {}

  async execute(input: IssueActivationLinkInput): Promise<IssueActivationLinkOutput> {
    if (!input.actor.isSuperAdmin) throw new AppError('FORBIDDEN')
    const stamp = { by: input.actor.id, at: this.clock.now() }
    const { user, activationLink } = await this.activationLinks.reissue(input.userId, stamp)
    // Only once the new link is stored and the previous one revoked.
    this.mailer.send(recipientOf(user), activationLink, stamp)
    return activationLink
  }
}
