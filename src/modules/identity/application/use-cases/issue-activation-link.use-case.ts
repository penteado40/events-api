import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ActivationLinkRepository } from '../../domain/activation-link.repository.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import { type IssuedActivationLink, reissueActivationLink } from '../issue-activation-link.js'
import type { InvitationIssuer } from '../ports/invitation-issuer.js'

export interface IssueActivationLinkInput {
  actor: User
  userId: number
}

export type IssueActivationLinkOutput = IssuedActivationLink

/** Reissues the Activation link of a Pending user (lost or expired link). */
export class IssueActivationLinkUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly links: ActivationLinkRepository,
    private readonly invitations: InvitationIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(input: IssueActivationLinkInput): Promise<IssueActivationLinkOutput> {
    if (!input.actor.isSuperAdmin) throw new AppError('FORBIDDEN')
    const stamp = { by: input.actor.id, at: this.clock.now() }
    return reissueActivationLink(this.users, this.links, this.invitations, input.userId, stamp)
  }
}
