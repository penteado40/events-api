import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsReader } from '../event-access.js'
import { type EventView, viewOf } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface GetEventInput {
  actor: ActingUser
  eventId: number
}

export type GetEventOutput = EventView

/** The Super admin or any Group member of its Group sees the Event; anyone else gets NOT_FOUND, so it does not leak. */
export class GetEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetEventInput): Promise<GetEventOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsReader(input.actor, event.groupId, this.directory)
    return viewOf(event, this.clock.now())
  }
}
