import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { LocalDate } from '../../../../shared/domain/local-date.vo.js'
import { LocalTime } from '../../../../shared/domain/local-time.vo.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemPlace } from '../../domain/event-item-place.vo.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'
import type { EventItemPlaceInput } from './create-event-item.use-case.js'

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
 * clears it; what is left must keep the time only with a date.
 */
export class EditEventItemUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly items: EventItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: EditEventItemInput): Promise<EditEventItemOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)
    const item = await this.items.findInEvent(event.id, input.itemId)
    if (!item) throw new AppError('NOT_FOUND')

    item.edit(
      {
        name: input.name === undefined ? undefined : EventItemName.create(input.name),
        date: input.date == null ? input.date : LocalDate.create(input.date),
        time: input.time == null ? input.time : LocalTime.create(input.time),
        place: input.place == null ? input.place : EventItemPlace.create(input.place),
      },
      { by: input.actor.id, at: this.clock.now() },
    )
    await this.items.save(item)
    return itemViewOf(item, event.period.timezone.value)
  }
}
