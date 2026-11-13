import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { changeEventState, type EventStateChangeDeps } from '../event-state-change.js'
import type { EventView } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface UncancelEventInput {
  actor: ActingUser
  eventId: number
}

export type UncancelEventOutput = EventView

/**
 * An Owner of its Group, or the Super admin, uncancels a Cancelled Event: it
 * goes back to the state it was cancelled from, Draft or published, and takes
 * writes again. One that is not Cancelled is EVENT_NOT_CANCELLED
 * (Event.uncancel). The move is a Change of the state (changeEventState).
 */
export class UncancelEventUseCase {
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

  async execute(input: UncancelEventInput): Promise<UncancelEventOutput> {
    return changeEventState(this.deps, input.actor, input.eventId, (event, stamp) =>
      event.uncancel(stamp),
    )
  }
}
