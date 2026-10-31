import type { Clock } from '../../../../shared/application/clock.js'
import { Phone } from '../../../../shared/domain/phone.vo.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import { type Me, meOf } from '../me.js'
import type { GroupMembers } from '../ports/group-members.js'

export interface UpdateMeInput {
  actor: User
  name?: string
  phone?: string
}

export type UpdateMeOutput = Me

/** The logged-in User edits their own name and phone; what is left out stays. Answers as `GET /me`. */
export class UpdateMeUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly groupMembers: GroupMembers,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateMeInput): Promise<UpdateMeOutput> {
    const phone = input.phone === undefined ? undefined : Phone.create(input.phone)
    const { actor } = input
    actor.editProfile({ name: input.name, phone }, { by: actor.id, at: this.clock.now() })
    await this.users.save(actor)
    return meOf(actor, this.groupMembers)
  }
}
