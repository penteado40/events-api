import type { User } from '../../domain/user.entity.js'
import type { GroupMembership, Memberships } from '../ports/memberships.js'

export interface GetMeInput {
  actor: User
}

export interface GetMeOutput {
  user: User
  isSuperAdmin: boolean
  memberships: GroupMembership[]
}

/**
 * The logged-in User, their Membership and whether they are the Super admin,
 * so the app knows what to show. The Super admin is never a Group member.
 */
export class GetMeUseCase {
  constructor(private readonly memberships: Memberships) {}

  async execute({ actor }: GetMeInput): Promise<GetMeOutput> {
    if (actor.isSuperAdmin) return { user: actor, isSuperAdmin: true, memberships: [] }
    return { user: actor, isSuperAdmin: false, memberships: await this.memberships.of(actor.id) }
  }
}
