import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { changeEventState, type EventStateChangeDeps } from '../event-state-change.js'
import type { EventView } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface PublishEventInput {
  actor: ActingUser
  eventId: number
}

export type PublishEventOutput = EventView

/**
 * An Owner of its Group, or the Super admin, publishes an Event in Draft: its
 * published Event items start to reach whom they reach. Only a Draft is
 * published (EVENT_NOT_DRAFT otherwise, EVENT_CANCELLED for a Cancelled one,
 * Event.publish). The move is a Change of the state (changeEventState).
 */
export class PublishEventUseCase {
  private readonly deps: EventStateChangeDeps

  constructor(
    directory: GroupDirectory,
    events: EventRepository,
    changeLog: ChangeRepository,
    unitOfWork: UnitOfWork,
    clock: Clock,
  ) {
    this.deps = { directory, events, changeLog, unitOfWork, clock }
  }

  async execute(input: PublishEventInput): Promise<PublishEventOutput> {
    return changeEventState(this.deps, input.actor, input.eventId, (event, stamp) =>
      event.publish(stamp),
    )
  }
}
