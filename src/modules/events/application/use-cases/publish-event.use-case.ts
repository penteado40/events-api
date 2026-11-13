import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventChanges } from '../../domain/event-changes.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import { type EventView, viewOf } from '../event-view.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface PublishEventInput {
  actor: ActingUser
  eventId: number
}

export type PublishEventOutput = EventView

/**
 * An Owner of its Group, or the Super admin, publishes an Event in Draft: its
 * published Event items start to reach whom they reach. Only a Draft is
 * published (EVENT_NOT_DRAFT otherwise, Event.publish).
 *
 * The move from Draft is a Change of the state, written in the same unit of
 * work as the Event (amendment of ADR-0010), with the reach of every Group
 * member read under the Group's lock, like the edit of the Event.
 */
export class PublishEventUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: PublishEventInput): Promise<PublishEventOutput> {
    const found = await this.events.findById(input.eventId)
    if (!found) throw new AppError('NOT_FOUND')
    const { groupId } = found
    await requireEventsEditor(input.actor, groupId, this.directory)

    const now = this.clock.now()
    const stamp = { by: input.actor.id, at: now }

    return this.unitOfWork.run(async () => {
      // Locks go Group, then Event, always (see EditEventUseCase).
      const reach = await this.directory.lockMemberIds(groupId)
      // Re-read under the lock: a publish that just landed makes this one EVENT_NOT_DRAFT.
      const event = await this.events.lockById(input.eventId)
      if (!event) throw new AppError('NOT_FOUND')
      const before = event.snapshot(reach)
      event.publish(stamp)
      await this.events.save(event)
      await this.changeLog.create(event.id, eventChanges(before, event.snapshot(reach)), stamp)
      return viewOf(event, now)
    })
  }
}
