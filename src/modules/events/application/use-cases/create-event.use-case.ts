import type { Clock } from '../../../../shared/application/clock.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod, type EventPeriodValues } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsManager } from '../event-access.js'
import { type EventView, viewOf } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface CreateEventInput {
  actor: ActingUser
  groupId: number
  name: string
  place: string
  period: EventPeriodValues
}

export type CreateEventOutput = EventView

/**
 * An Owner of the Group, or the Super admin, creates an Event, born in Draft:
 * every Group member already sees where and when. An end date before the start
 * date is EVENT_PERIOD_INVALID.
 */
export class CreateEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateEventInput): Promise<CreateEventOutput> {
    await requireEventsManager(input.actor, input.groupId, this.directory)
    const now = this.clock.now()
    const event = await this.events.create(
      {
        groupId: input.groupId,
        name: EventName.create(input.name),
        place: EventPlace.create(input.place),
        period: EventPeriod.create(input.period),
      },
      { by: input.actor.id, at: now },
    )
    return viewOf(event, now)
  }
}
