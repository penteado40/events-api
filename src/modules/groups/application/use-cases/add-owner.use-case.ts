import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { GroupMember } from '../../domain/group-member.js'
import type { GroupMemberRepository } from '../../domain/group-member.repository.js'
import type { GroupRosterRepository } from '../../domain/group-roster.repository.js'
import { type ActingUser, actorOf } from '../actor.js'
import type {
  GroupActivationLink,
  GroupUser,
  GroupUserAccounts,
} from '../ports/group-user-accounts.js'

export interface AddOwnerInput {
  actor: ActingUser
  groupId: number
  email: string
  /** Name and phone are used only when the email has no User yet. */
  name: string
  phone: string
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
 * Activation link goes back in the answer. Who cannot see the Group gets
 * NOT_FOUND; a Group member gets FORBIDDEN.
 */
export class AddOwnerUseCase {
  constructor(
    private readonly rosters: GroupRosterRepository,
    private readonly members: GroupMemberRepository,
    private readonly accounts: GroupUserAccounts,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddOwnerInput): Promise<AddOwnerOutput> {
    const actor = await actorOf(input.actor, this.members)
    const { groupId } = input
    const roster = AccessPolicy.can(actor, { type: 'viewGroup', groupId })
      ? await this.rosters.findByGroup(groupId)
      : null
    if (!roster) throw new AppError('NOT_FOUND')
    if (!AccessPolicy.can(actor, { type: 'addOwner', groupId })) throw new AppError('FORBIDDEN')

    const stamp = { by: input.actor.id, at: this.clock.now() }
    const { user, activationLink } = await this.accounts.ensureUser(
      { email: input.email, name: input.name, phone: input.phone },
      stamp,
    )
    try {
      const member = roster.addOwner({ userId: user.id, isSuperAdmin: user.isSuperAdmin }, stamp)
      await this.rosters.save(roster)
      return { member, user, activationLink }
    } catch (error) {
      // A Pending user born for nothing keeps no usable link (ADR-0014).
      if (activationLink) await this.dropLink(user.id, error)
      throw error
    }
  }

  private async dropLink(userId: number, cause: unknown): Promise<void> {
    try {
      await this.accounts.dropPendingActivation(userId)
    } catch (dropError) {
      throw new AggregateError(
        [cause, dropError],
        `Gravação do Owner falhou e o Activation link do User ${userId} ficou aberto: revogue-o no Clerk`,
        { cause: dropError },
      )
    }
  }
}
