import { AppError } from '../../../../shared/domain/app-error.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import { positionAfter } from '../../domain/event-item-order.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemPlace, type EventItemPlaceInput } from '../../domain/event-item-place.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventItem } from '../../domain/event-item.entity.js'
import { itemReachContext } from '../item-reach-context.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'

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
 * An Owner of its Group, or the Super admin, creates an Event item: in an
 * Event in Draft it is born published, in a published Event in Draft
 * (EventItem.bornIn), by the state the Event has under its lock. Date and
 * time are local and optional, the time only with a date (else
 * EVENT_ITEM_TIME_WITHOUT_DATE); the place is optional, and without its own
 * zone the Event's applies. A Cancelled Event is frozen: EVENT_CANCELLED.
 *
 * The creation is a Change of the item, written in the same unit of work
 * (amendment of ADR-0010), reaching whom the reach rule says, over the Event
 * and its Participants and the Group members read under the Group's lock;
 * before it, the item reached no one.
 */
export class CreateEventItemUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: CreateEventItemInput): Promise<CreateEventItemOutput> {
    const event = await this.deps.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.deps.directory)

    const props = {
      eventId: event.id,
      name: EventItemName.create(input.name),
      start: EventItemStart.create({ date: input.date ?? null, time: input.time ?? null }),
      place: input.place == null ? null : EventItemPlace.create(input.place),
    }

    const stamp = { by: input.actor.id, at: this.deps.clock.now() }

    return this.deps.unitOfWork.run(async () => {
      // Locks go Group, then Event, always (see lockEventItem).
      const members = await this.deps.directory.lockMembers(event.groupId)
      // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
      const frozen = await this.deps.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      const reach = await itemReachContext(frozen, members, this.deps.participants)
      // Last in the order of the production; the lock keeps two creations off the same position.
      const position = positionAfter(await this.deps.items.findAllInEvent(event.id))
      // Under the lock: a publish of the Event that came first makes it born in Draft.
      const state = EventItem.bornIn(frozen.state)
      const item = await this.deps.items.create({ ...props, state, position }, stamp)
      await this.deps.changeLog.create(
        event.id,
        // A new item has no Fields yet.
        eventItemChanges(null, item.snapshot(), reach, []),
        stamp,
      )
      return itemViewOf(item, event.period.timezone.value)
    })
  }
}
