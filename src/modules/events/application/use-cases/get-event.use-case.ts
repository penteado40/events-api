import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ParticipantRepository } from '../../domain/participant.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsReader } from '../event-access.js'
import { type EventView, viewOf } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface GetEventInput {
  actor: ActingUser
  eventId: number
}

/** The Membership of who asks, on this Event: whether they are a Participant of it. */
export interface EventMembership {
  isParticipant: boolean
}

export type GetEventOutput = EventView & {
  /** null for the Super admin, who has no Membership. */
  membership: EventMembership | null
}

/**
 * The Super admin or any Group member of its Group sees the Event, with their
 * Membership on it; anyone else gets NOT_FOUND, so it does not leak.
 */
export class GetEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetEventInput): Promise<GetEventOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsReader(input.actor, event.groupId, this.directory)
    const membership = input.actor.isSuperAdmin
      ? null
      : { isParticipant: await this.participants.isParticipant(event.id, input.actor.id) }
    return { ...viewOf(event, this.clock.now()), membership }
  }
}
