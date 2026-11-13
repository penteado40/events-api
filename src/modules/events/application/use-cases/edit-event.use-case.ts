import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventChanges } from '../../domain/event-changes.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod, type EventPeriodValues } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
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
 *
 * Each attribute that changed becomes a Change (CONTEXT.md), written in the
 * same unit of work as the Event, never by a domain event handler (amendment
 * of ADR-0010): both commit or neither does. An edit that changes nothing
 * writes nothing. The reach of a Change of an Event is every Group member.
 */
export class EditEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: EditEventInput): Promise<EditEventOutput> {
    const found = await this.events.findById(input.eventId)
    if (!found) throw new AppError('NOT_FOUND')
    const { groupId } = found
    await requireEventsEditor(input.actor, groupId, this.directory)

    const edit = {
      name: input.name === undefined ? undefined : EventName.create(input.name),
      place: input.place === undefined ? undefined : EventPlace.create(input.place),
      period: input.period === undefined ? undefined : EventPeriod.create(input.period),
    }
    const now = this.clock.now()
    const stamp = { by: input.actor.id, at: now }

    return this.unitOfWork.run(async () => {
      // Where and when are seen by every Group member (Draft included). The
      // roster is held until commit (ADR-0014), so the reach is the one that
      // stands when the Changes land; edits in the same Group queue on it too.
      // Locks go Group, then Event, always.
      const reach = await this.directory.lockMemberIds(groupId)
      // Re-read under the lock: the Changes start from what the last edit left.
      const event = await this.events.lockById(input.eventId)
      if (!event) throw new AppError('NOT_FOUND')
      const before = event.snapshot(reach)
      event.edit(edit, stamp)
      const changes = eventChanges(before, event.snapshot(reach))
      if (changes.length > 0) {
        await this.events.save(event)
        await this.changeLog.create(event.id, changes, stamp)
      }
      return viewOf(event, now)
    })
  }
}
