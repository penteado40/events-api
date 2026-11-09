import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'
import type { GroupMailer, GroupMailInviter } from '../ports/group-mailer.js'
import type { GroupUserAccounts, ReissuedGroupLink } from '../ports/group-user-accounts.js'

export interface ReissueActivationLinkInput {
  actor: ActingUser
  /** Where the answer to the email goes: whoever made the action. */
  inviter: GroupMailInviter
  groupId: number
  /** The pending Group member who needs a new Activation link. */
  userId: number
}

/**
 * An Owner of the Group, or the Super admin, gives a pending Group member a
 * new Activation link when the invitation did not arrive: the previous link
 * is revoked, the new one goes back in the answer and by email to the
 * person. Only a Group member of this Group qualifies (NOT_FOUND otherwise);
 * one who already signed in gets USER_ALREADY_ACTIVE. Who cannot see the
 * Group gets NOT_FOUND; a Viewer gets FORBIDDEN.
 */
export class ReissueActivationLinkUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly accounts: GroupUserAccounts,
    private readonly mailer: GroupMailer,
    private readonly clock: Clock,
  ) {}

  async execute(input: ReissueActivationLinkInput): Promise<ReissuedGroupLink> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
      ? await this.groups.findById(groupId)
      : null
    const roster = group ? await this.rosters.findByGroup(groupId) : null
    if (!group || !roster) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'manageViewers', groupId }))
      throw new AppError('FORBIDDEN')
    if (roster.roleOf(input.userId) === null) throw new AppError('NOT_FOUND')

    const stamp = { by: input.actor.id, at: this.clock.now() }
    const { user, activationLink } = await this.accounts.reissueActivationLink(input.userId, stamp)
    // Only once the new link is stored and the previous one revoked.
    this.mailer.sendActivationLink(
      { name: group.name },
      { email: user.email, name: user.name },
      activationLink,
      input.inviter,
      stamp,
    )
    return { user, activationLink }
  }
}
