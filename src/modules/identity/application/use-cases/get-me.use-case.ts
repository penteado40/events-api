import type { User } from '../../domain/user.entity.js'
import { type Me, meOf } from '../me.js'
import type { GroupMembers } from '../ports/group-members.js'

export interface GetMeInput {
  actor: User
}

export type GetMeOutput = Me

/** The logged-in User sees themselves, with their Membership. */
export class GetMeUseCase {
  constructor(private readonly groupMembers: GroupMembers) {}

  execute({ actor }: GetMeInput): Promise<GetMeOutput> {
    return meOf(actor, this.groupMembers)
  }
}
