import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { LocalDate } from '../../../../shared/domain/local-date.vo.js'
import { LocalTime } from '../../../../shared/domain/local-time.vo.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemPlace, type EventItemPlaceInput } from '../../domain/event-item-place.vo.js'
import type { EventItemRepository } from '../../domain/event-item.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventItemView, itemViewOf } from '../event-item-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

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
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: EditEventItemInput): Promise<EditEventItemOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, event.groupId, this.directory)

    const edit = {
      name: input.name === undefined ? undefined : EventItemName.create(input.name),
      // undefined keeps it, null clears it, a value replaces it.
      date: keepClearOr(input.date, LocalDate.create),
      time: keepClearOr(input.time, LocalTime.create),
      place: keepClearOr(input.place, EventItemPlace.create),
    }

    return this.unitOfWork.run(async () => {
      // Under the lock, the edit starts from what the last write left; a delete leaves NOT_FOUND.
      const item = await this.items.lockInEvent(event.id, input.itemId)
      if (!item) throw new AppError('NOT_FOUND')
      item.edit(edit, { by: input.actor.id, at: this.clock.now() })
      await this.items.save(item)
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
