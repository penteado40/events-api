import type { ActingUser } from '../actor.js'
import { changeEventItemState } from '../event-item-state-change.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import type { EventItemView } from '../event-item-view.js'

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
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: CancelEventItemInput): Promise<CancelEventItemOutput> {
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    return changeEventItemState(
      this.deps,
      input.actor,
      { eventId: input.eventId, itemId: input.itemId },
      stamp,
      (item) => item.cancel(stamp),
    )
  }
}
