import type { ActingUser } from '../actor.js'
import { changeEventItemState } from '../event-item-state-change.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import type { EventItemView } from '../event-item-view.js'

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
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: UncancelEventItemInput): Promise<UncancelEventItemOutput> {
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    return changeEventItemState(
      this.deps,
      input.actor,
      { eventId: input.eventId, itemId: input.itemId },
      stamp,
      (item) => item.uncancel(stamp),
    )
  }
}
