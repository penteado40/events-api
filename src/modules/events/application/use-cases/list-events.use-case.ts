import type { Clock } from '../../../../shared/application/clock.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsReader } from '../event-access.js'
import { type EventView, viewOf } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface ListEventsInput {
  actor: ActingUser
  groupId: number
}

export type ListEventsOutput = EventView[]

/**
 * The Super admin or any Group member sees the Events of the Group, Drafts
 * included (where and when are visible from birth), by start date, each with
 * whether it is a Finished event now.
 */
export class ListEventsUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListEventsInput): Promise<ListEventsOutput> {
    await requireEventsReader(input.actor, input.groupId, this.directory)
    const now = this.clock.now()
    return (await this.events.findByGroup(input.groupId)).map((event) => viewOf(event, now))
  }
}
