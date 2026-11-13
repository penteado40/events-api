import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemPlace } from '../../domain/event-item-place.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

/** A place as it comes in: each part optional, not all missing. */
export interface EventItemPlaceInput {
  name?: string | null
  address?: string | null
  /** IANA zone of the place; without it, the Event's applies. */
  timezone?: string | null
}

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
 * optional, and without its own zone the Event's applies.
 */
export class CreateEventItemUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateEventItemInput): Promise<CreateEventItemOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)

    const item = await this.items.create(
      {
        eventId: event.id,
        name: EventItemName.create(input.name),
        start: EventItemStart.create({ date: input.date ?? null, time: input.time ?? null }),
        place: input.place == null ? null : EventItemPlace.create(input.place),
      },
      { by: input.actor.id, at: this.clock.now() },
    )
    return itemViewOf(item, event.period.timezone.value)
  }
}
