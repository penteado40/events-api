import { AppError } from '../../../../shared/domain/app-error.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import { itemReachContext } from '../item-reach-context.js'
import type { ActingUser } from '../actor.js'
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
      // Locks go Group, Event, item, always (see EditEventItemUseCase).
      const members = await this.deps.directory.lockMembers(event.groupId)
      // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
      const frozen = await this.deps.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      const reach = await itemReachContext(frozen, members, this.deps.participants)
      // Under the lock, a delete or an edit that came first leaves it gone: NOT_FOUND.
      const item = await this.deps.items.lockInEvent(event.id, input.itemId)
      if (!item) throw new AppError('NOT_FOUND')
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
