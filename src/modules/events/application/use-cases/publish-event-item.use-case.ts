import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

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
 * frozen: EVENT_CANCELLED.
 *
 * The move is a Change of the state of the item, written in the same unit of
 * work (amendment of ADR-0010), with the reach of before and of after from
 * the reach rule over the Group members read under the Group's lock.
 */
export class PublishEventItemUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: PublishEventItemInput): Promise<PublishEventItemOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)
    const stamp = { by: input.actor.id, at: this.clock.now() }

    return this.unitOfWork.run(async () => {
      // Locks go Group, Event, item, always (see EditEventItemUseCase).
      const members = await this.directory.lockMembers(event.groupId)
      // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
      const frozen = await this.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      // Under the lock, of two publishes that race, the second finds it published; a delete leaves NOT_FOUND.
      const item = await this.items.lockInEvent(event.id, input.itemId)
      if (!item) throw new AppError('NOT_FOUND')
      const before = item.snapshot()
      item.publish(stamp)
      await this.items.save(item)
      await this.changeLog.create(
        event.id,
        eventItemChanges(before, item.snapshot(), members),
        stamp,
      )
      return itemViewOf(item, event.period.timezone.value)
    })
  }
}
