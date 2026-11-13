import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { changeEventState, type EventStateChangeDeps } from '../event-state-change.js'
import type { EventView } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface CancelEventInput {
  actor: ActingUser
  eventId: number
}

export type CancelEventOutput = EventView

/**
 * An Owner of its Group, or the Super admin, cancels an Event in Draft or
 * published: it stays visible, Cancelled, and frozen (no write in it nor in its
 * Event items) until uncancelled. One already Cancelled is EVENT_CANCELLED
 * (Event.cancel). The move is a Change of the state (changeEventState).
 */
export class CancelEventUseCase {
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

  async execute(input: CancelEventInput): Promise<CancelEventOutput> {
    return changeEventState(this.deps, input.actor, input.eventId, (event, stamp) =>
      event.cancel(stamp),
    )
  }
}
