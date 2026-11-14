import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { changeEventItemState, type EventItemStateChangeDeps } from '../event-item-state-change.js'
import type { EventItemView } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface UncancelEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
}

export type UncancelEventItemOutput = EventItemView

/**
 * An Owner of its Group, or the Super admin, uncancels a Cancelled Event
 * item: it goes back to published and takes writes again. One that is not
 * Cancelled is EVENT_ITEM_NOT_CANCELLED (EventItem.uncancel). A Cancelled
 * Event is frozen: EVENT_CANCELLED. The move is a Change of the state of the
 * item (changeEventItemState).
 */
export class UncancelEventItemUseCase {
  private readonly deps: EventItemStateChangeDeps
  private readonly clock: Clock

  constructor(
    directory: GroupDirectory,
    events: EventRepository,
    items: EventItemRepository,
    changeLog: ChangeRepository,
    unitOfWork: UnitOfWork,
    clock: Clock,
  ) {
    this.deps = { directory, events, items, changeLog, unitOfWork }
    this.clock = clock
  }

  async execute(input: UncancelEventItemInput): Promise<UncancelEventItemOutput> {
    const stamp = { by: input.actor.id, at: this.clock.now() }
    return changeEventItemState(this.deps, input.actor, input, stamp, (item) =>
      item.uncancel(stamp),
    )
  }
}
