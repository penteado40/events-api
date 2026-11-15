import type { User } from '../../domain/user.entity.js'
import { type Me, meOf } from '../me.js'
import type { EventParticipations } from '../ports/event-participations.js'
import type { GroupMembers } from '../ports/group-members.js'

export interface GetMeInput {
  actor: User
}

export type GetMeOutput = Me

/** The logged-in User sees themselves, with their Membership: per Group, the role and the Events they are a Participant of. */
export class GetMeUseCase {
  constructor(
    private readonly groupMembers: GroupMembers,
    private readonly participations: EventParticipations,
  ) {}

  execute({ actor }: GetMeInput): Promise<GetMeOutput> {
    return meOf(actor, this.groupMembers, this.participations)
  }
}
