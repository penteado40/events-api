import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ParticipantRepository } from '../../domain/participant.repository.js'
import type { ActingUser } from '../actor.js'
import { changeEventItemState, type EventItemStateChangeDeps } from '../event-item-state-change.js'
import type { EventItemView } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface CancelEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
}

export type CancelEventItemOutput = EventItemView

/**
 * An Owner of its Group, or the Super admin, cancels a published Event item:
 * it stays in the schedule, Cancelled, and frozen until uncancelled. A Draft
 * is EVENT_ITEM_NOT_PUBLISHED (it is deleted, not cancelled), one already
 * Cancelled EVENT_ITEM_CANCELLED (EventItem.cancel). A Cancelled Event is
 * frozen: EVENT_CANCELLED. The move is a Change of the state of the item
 * (changeEventItemState).
 */
export class CancelEventItemUseCase {
  private readonly deps: EventItemStateChangeDeps
  private readonly clock: Clock

  constructor(
    directory: GroupDirectory,
    events: EventRepository,
    items: EventItemRepository,
    participants: ParticipantRepository,
    changeLog: ChangeRepository,
    unitOfWork: UnitOfWork,
    clock: Clock,
  ) {
    this.deps = { directory, events, items, participants, changeLog, unitOfWork }
    this.clock = clock
  }

  async execute(input: CancelEventItemInput): Promise<CancelEventItemOutput> {
    const stamp = { by: input.actor.id, at: this.clock.now() }
    return changeEventItemState(
      this.deps,
      input.actor,
      { eventId: input.eventId, itemId: input.itemId },
      stamp,
      (item) => item.cancel(stamp),
    )
  }
}
