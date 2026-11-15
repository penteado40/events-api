import type { ActingUser } from '../actor.js'
import { changeEventItemState } from '../event-item-state-change.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import type { EventItemView } from '../event-item-view.js'

export interface PublishEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
}

export type PublishEventItemOutput = EventItemView

/**
 * An Owner of its Group, or the Super admin, publishes an Event item in
 * Draft: it starts to reach whom it reaches. Only a Draft is published
 * (EVENT_ITEM_NOT_DRAFT otherwise, EventItem.publish). A Cancelled Event is
 * frozen: EVENT_CANCELLED. The move is a Change of the state of the item
 * (changeEventItemState).
 */
export class PublishEventItemUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: PublishEventItemInput): Promise<PublishEventItemOutput> {
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    return changeEventItemState(
      this.deps,
      input.actor,
      { eventId: input.eventId, itemId: input.itemId },
      stamp,
      (item) => item.publish(stamp),
    )
  }
}
