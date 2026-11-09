import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMember } from '../../domain/group-member.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import type { GroupRepository } from '../../domain/group.repository.js'
import { type ActingUser, actorOf } from '../actor.js'
import { dropLink, emailEntry } from '../group-entry.js'
import type { GroupMailer, GroupMailInviter } from '../ports/group-mailer.js'
import type {
  GroupActivationLink,
  GroupUser,
  GroupUserAccounts,
  GroupUserContact,
} from '../ports/group-user-accounts.js'

/** Name and phone are used only when the email has no User yet. */
export interface AddOwnerInput extends GroupUserContact {
  actor: ActingUser
  /** Where the answer to the email goes: whoever made the action. */
  inviter: GroupMailInviter
  groupId: number
}

export interface AddOwnerOutput {
  member: GroupMember
  user: GroupUser
  /** Only when the Owner was created now, as a Pending user. */
  activationLink: GroupActivationLink | null
}

/**
 * The Super admin gives a person the role of Owner in a Group, by email
 * (ADR-0017). Without a User for the email, a Pending user is born and their
 * Activation link goes back in the answer. The User is ensured before the
 * Group's lock is taken, and the Roster is read again under it (ADR-0014).
 * Who cannot see the Group gets NOT_FOUND; a Group member gets FORBIDDEN.
 */
export class AddOwnerUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly groups: GroupRepository,
    private readonly members: GroupMemberRepository,
    private readonly accounts: GroupUserAccounts,
    private readonly mailer: GroupMailer,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddOwnerInput): Promise<AddOwnerOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    const group = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
      ? await this.groups.findById(groupId)
      : null
    if (!group || (await this.rosters.findByGroup(groupId)) === null)
      throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'manageOwners', groupId })) throw new AppError('FORBIDDEN')

    const stamp = { by: input.actor.id, at: this.clock.now() }
    const { user, activationLink } = await this.accounts.ensureUser(
      { email: input.email, name: input.name, phone: input.phone },
      stamp,
    )
    try {
      const member = await this.unitOfWork.run(async () => {
        const roster = await this.rosters.lockByGroup(groupId)
        if (!roster) throw new AppError('NOT_FOUND')
        const added = roster.addOwner({ userId: user.id, isSuperAdmin: user.isSuperAdmin }, stamp)
        await this.rosters.save(roster)
        return added
      })
      emailEntry(this.mailer, group, user, activationLink, input.inviter, stamp)
      return { member, user, activationLink }
    } catch (error) {
      // A Pending user born for nothing keeps no usable link (ADR-0014).
      if (activationLink) await dropLink(this.accounts, user.id, 'Owner', error)
      throw error
    }
  }
}
