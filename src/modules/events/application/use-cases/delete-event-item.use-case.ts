import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface DeleteEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
}

/**
 * An Owner of its Group, or the Super admin, deletes an Event item of the Event.
 * A Cancelled Event is frozen: EVENT_CANCELLED.
 *
 * The removal is a Change of the item, written in the same unit of work
 * (amendment of ADR-0010), with what the item was and whom it reached right
 * before, by the reach rule over the Group members read under the Group's
 * lock; after it, the item reaches no one. The Change outlives the item.
 */
export class DeleteEventItemUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: DeleteEventItemInput): Promise<void> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)
    const stamp = { by: input.actor.id, at: this.clock.now() }
    await this.unitOfWork.run(async () => {
      // Locks go Group, Event, item, always (see EditEventItemUseCase).
      const members = await this.directory.lockMembers(event.groupId)
      // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
      const frozen = await this.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      // Under the lock, a delete or an edit that came first leaves it gone: NOT_FOUND.
      const item = await this.items.lockInEvent(event.id, input.itemId)
      if (!item) throw new AppError('NOT_FOUND')
      await this.items.delete(item.id)
      await this.changeLog.create(event.id, eventItemChanges(item.snapshot(), null, members), stamp)
    })
  }
}
