import { AppError } from '../../../../shared/domain/app-error.js'
import { LocalDate } from '../../../../shared/domain/local-date.vo.js'
import { LocalTime } from '../../../../shared/domain/local-time.vo.js'
import { eventItemChanges } from '../../domain/event-item-changes.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemPlace, type EventItemPlaceInput } from '../../domain/event-item-place.vo.js'
import { itemReachContext } from '../item-reach-context.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'

export interface EditEventItemInput {
  actor: ActingUser
  eventId: number
  itemId: number
  name?: string
  /** null clears it (with the time, or EVENT_ITEM_TIME_WITHOUT_DATE). */
  date?: string | null
  /** null clears it. */
  time?: string | null
  /** The whole place, replaced at once; null clears it. */
  place?: EventItemPlaceInput | null
}

export type EditEventItemOutput = EventItemView

/**
 * An Owner of its Group, or the Super admin, edits the name, the date, the
 * time or the place of an Event item. A field left out stays as it is, null
 * clears it; what is left must keep the time only with a date. A Cancelled
 * Event is frozen: EVENT_CANCELLED; and so is a Cancelled item:
 * EVENT_ITEM_CANCELLED (EventItem.edit).
 *
 * Each attribute that changed becomes a Change, written in the same unit of
 * work as the item (amendment of ADR-0010); an edit that changes nothing
 * writes nothing. The reach of before and of after comes from the reach rule
 * over the Event, its Participants and the Group members, read under the
 * Group's lock.
 */
export class EditEventItemUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: EditEventItemInput): Promise<EditEventItemOutput> {
    const event = await this.deps.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    const { groupId } = event
    await requireEventsEditor(input.actor, groupId, this.deps.directory)

    const edit = {
      name: input.name === undefined ? undefined : EventItemName.create(input.name),
      // undefined keeps it, null clears it, a value replaces it.
      date: keepClearOr(input.date, LocalDate.create),
      time: keepClearOr(input.time, LocalTime.create),
      place: keepClearOr(input.place, EventItemPlace.create),
    }

    const stamp = { by: input.actor.id, at: this.deps.clock.now() }

    return this.deps.unitOfWork.run(async () => {
      // The roster is held until commit (ADR-0014), so the reach is the one
      // that stands when the Changes land. Locks go Group, Event, item, always.
      const members = await this.deps.directory.lockMembers(groupId)
      // Under the Event's lock, a cancel that came first freezes the item: EVENT_CANCELLED.
      const frozen = await this.deps.events.lockById(event.id)
      if (!frozen) throw new AppError('NOT_FOUND')
      frozen.assertWritable()
      const reach = await itemReachContext(frozen, members, this.deps.participants)
      // Under the lock, the edit starts from what the last write left; a delete leaves NOT_FOUND.
      const item = await this.deps.items.lockInEvent(event.id, input.itemId)
      if (!item) throw new AppError('NOT_FOUND')
      const before = item.snapshot()
      item.edit(edit, stamp)
      const changes = eventItemChanges(before, item.snapshot(), reach)
      if (changes.length > 0) {
        await this.deps.items.save(item)
        await this.deps.changeLog.create(event.id, changes, stamp)
      }
      return itemViewOf(item, event.period.timezone.value)
    })
  }
}

function keepClearOr<Raw, Value>(
  raw: Raw | null | undefined,
  create: (raw: Raw) => Value,
): Value | null | undefined {
  if (raw === undefined) return undefined
  return raw === null ? null : create(raw)
}
