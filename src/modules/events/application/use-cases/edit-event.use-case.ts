import type { Clock } from '../../../../shared/application/clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod, type EventPeriodValues } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsManager } from '../event-access.js'
import { type EventView, viewOf } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface EditEventInput {
  actor: ActingUser
  eventId: number
  name?: string
  place?: string
  /** The whole period, replaced at once. */
  period?: EventPeriodValues
}

export type EditEventOutput = EventView

/**
 * An Owner of its Group, or the Super admin, edits the name, the place or the
 * period of an Event, a Finished event included. A field left out stays as it
 * is; an end date before the start date is EVENT_PERIOD_INVALID.
 */
export class EditEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: EditEventInput): Promise<EditEventOutput> {
    const event = await this.events.findById(input.eventId)
    if (!event) throw new AppError('NOT_FOUND')
    await requireEventsManager(input.actor, event.groupId, this.directory)

    const changes = {
      name: input.name === undefined ? undefined : EventName.create(input.name),
      place: input.place === undefined ? undefined : EventPlace.create(input.place),
      period: input.period === undefined ? undefined : EventPeriod.create(input.period),
    }
    const now = this.clock.now()
    event.edit(changes, { by: input.actor.id, at: now })
    await this.events.save(event)
    return viewOf(event, now)
  }
}
