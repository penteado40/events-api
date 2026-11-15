import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod, type EventPeriodValues } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ParticipantRepository } from '../../domain/participant.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
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
 *
 * The list of Participants is born as a copy of every Group member of the
 * moment (Owners and Viewers), in the same unit of work as the Event: who
 * joins the Group later does not become a Participant of it.
 */
export class CreateEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateEventInput): Promise<CreateEventOutput> {
    await requireEventsEditor(input.actor, input.groupId, this.directory)
    const props = {
      groupId: input.groupId,
      name: EventName.create(input.name),
      place: EventPlace.create(input.place),
      period: EventPeriod.create(input.period),
    }
    const now = this.clock.now()
    const stamp = { by: input.actor.id, at: now }

    return this.unitOfWork.run(async () => {
      // The roster is held until commit (ADR-0014): a Viewer added or removed
      // meanwhile lands either before the copy, and is in it, or after it.
      const members = await this.directory.lockMembers(input.groupId)
      const event = await this.events.create(props, stamp)
      await this.participants.create(
        event.id,
        members.map((m) => m.userId),
        stamp,
      )
      return viewOf(event, now)
    })
  }
}
