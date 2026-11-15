import { AppError } from '../../../../shared/domain/app-error.js'
import type { GroupRole } from '../../domain/event-access-policy.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ParticipantRepository } from '../../domain/participant.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsReader } from '../event-access.js'
import type { GroupDirectory } from '../ports/group-directory.js'
import type { UserDirectory } from '../ports/user-directory.js'

export interface ListParticipantsInput {
  actor: ActingUser
  eventId: number
}

export interface ParticipantView {
  userId: number
  name: string
  phone: string
  /** The role in the Group now; null for a Participant who is no longer a Group member. */
  role: GroupRole | null
}

export type ListParticipantsOutput = ParticipantView[]

/**
 * The Super admin or any Group member of its Group, going or not, sees who the
 * Participants of the Event are, with the name, the phone (to open WhatsApp)
 * and the role in the Group, in the order of the list; anyone else gets
 * NOT_FOUND, so it does not leak.
 */
export class ListParticipantsUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly users: UserDirectory,
  ) {}

  async execute(input: ListParticipantsInput): Promise<ListParticipantsOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsReader(input.actor, event.groupId, this.directory)

    const userIds = await this.participants.findByEvent(event.id)
    const [users, members] = await Promise.all([
      this.users.findManyByIds(userIds),
      this.directory.members(event.groupId),
    ])
    const byId = new Map(users.map((u) => [u.id, u]))
    const roles = new Map(members.map((m) => [m.userId, m.role]))
    // A User is never deleted (ADR-0013) and the FK is Restrict: a Participant
    // always has their User, so skipping a missing one never hides anyone.
    return userIds.flatMap((userId) => {
      const user = byId.get(userId)
      return user
        ? [{ userId, name: user.name, phone: user.phone, role: roles.get(userId) ?? null }]
        : []
    })
  }
}
