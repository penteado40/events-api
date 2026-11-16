import { AppError } from '../../../../shared/domain/app-error.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import type { ActingUser } from '../actor.js'
import { lockEventItem } from '../event-item-lock.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { requireEventsEditor } from '../event-access.js'

export interface DeleteEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
}

/**
 * An Owner of its Group, or the Super admin, deletes an Event item of the Event,
 * in Draft or published. A Cancelled Event is frozen: EVENT_CANCELLED; and so
 * is a Cancelled item: EVENT_ITEM_CANCELLED.
 *
 * The removal is a Change of the item, written in the same unit of work
 * (amendment of ADR-0010), with what the item was and whom it reached right
 * before, by the reach rule over the Event, its Participants and the Group
 * members read under the Group's lock; after it, the item reaches no one. The Change outlives the item.
 */
export class DeleteEventItemUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: DeleteEventItemInput): Promise<void> {
    const event = await this.deps.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.deps.directory)
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    await this.deps.unitOfWork.run(async () => {
      // Under the locks, a delete that came first leaves it gone: NOT_FOUND (lockEventItem).
      const { item, reach } = await lockEventItem(this.deps, {
        groupId: event.groupId,
        eventId: event.id,
        itemId: input.itemId,
      })
      // A Cancelled item is frozen until uncancelled: EVENT_ITEM_CANCELLED.
      item.assertWritable()
      await this.deps.items.delete(item.id)
      await this.deps.changeLog.create(
        event.id,
        eventItemChanges(item.snapshot(), null, reach),
        stamp,
      )
    })
  }
}
