import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemPlace, type EventItemPlaceInput } from '../../domain/event-item-place.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface CreateEventItemInput {
  actor: ActingUser
  eventId: number
  name: string
  /** `YYYY-MM-DD`, local; without it, the item goes to the General info. */
  date?: string | null
  /** `HH:mm`, local, only with a date. */
  time?: string | null
  place?: EventItemPlaceInput | null
}

export type CreateEventItemOutput = EventItemView

/**
 * An Owner of its Group, or the Super admin, creates an Event item in an Event
 * in Draft, where it is born published. Date and time are local and optional,
 * the time only with a date (else EVENT_ITEM_TIME_WITHOUT_DATE); the place is
 * optional, and without its own zone the Event's applies. A Cancelled Event is
 * frozen: EVENT_CANCELLED.
 *
 * The creation is a Change of the item, written in the same unit of work
 * (amendment of ADR-0010), reaching whom the reach rule says, over the Group
 * members read under the Group's lock; before it, the item reached no one.
 */
export class CreateEventItemUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateEventItemInput): Promise<CreateEventItemOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)

    // Every Event is in Draft for now, so the item is born published. With
    // publishing the Event (PROJ-185, PROJ-194), it is born in Draft there.
    const props = {
      eventId: event.id,
      name: EventItemName.create(input.name),
      start: EventItemStart.create({ date: input.date ?? null, time: input.time ?? null }),
      place: input.place == null ? null : EventItemPlace.create(input.place),
    }

    const stamp = { by: input.actor.id, at: this.clock.now() }

    return this.unitOfWork.run(async () => {
      // Locks go Group, then Event, always (see EditEventItemUseCase).
      const members = await this.directory.lockMembers(event.groupId)
      // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
      const frozen = await this.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      const item = await this.items.create(props, stamp)
      await this.changeLog.create(event.id, eventItemChanges(null, item.snapshot(), members), stamp)
      return itemViewOf(item, event.period.timezone.value)
    })
  }
}
