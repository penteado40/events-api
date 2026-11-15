import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventReach } from '../../domain/event-reach.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { participantJoined } from '../../domain/participant-changes.js'
import type { ParticipantRepository } from '../../domain/participant.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface AddParticipantInput {
  actor: ActingUser
  eventId: number
  userId: number
}

/**
 * An Owner of its Group, or the Super admin, adds a Group member of that
 * Group (Owner or Viewer) to the Participants of the Event; anyone else is
 * NOT_FOUND. Adding who is already a Participant changes nothing. A Cancelled
 * Event is frozen: EVENT_CANCELLED.
 *
 * The entry is a Change that only the production sees, written in the same
 * unit of work (amendment of ADR-0010). The Group's roster and the Event are
 * held until commit (ADR-0014; locks go Group, then Event, always), so a
 * Viewer removed meanwhile is not added, and the writes of the Event's items,
 * which read the Participants under the same locks, see the list before or
 * after, never half of it.
 */
export class AddParticipantUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddParticipantInput): Promise<void> {
    const found = await this.events.findById(input.eventId)
    if (!found) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, found.groupId, this.directory)
    const stamp = { by: input.actor.id, at: this.clock.now() }

    await this.unitOfWork.run(async () => {
      const members = await this.directory.lockMembers(found.groupId)
      const event = await this.events.lockById(input.eventId)
      if (!event) throw new AppError('NOT_FOUND')
      event.assertWritable()
      if (!members.some((m) => m.userId === input.userId)) throw new AppError('NOT_FOUND')
      if (await this.participants.isParticipant(event.id, input.userId)) return
      await this.participants.create(event.id, [input.userId], stamp)
      await this.changeLog.create(
        event.id,
        [participantJoined(input.userId, eventReach(members))],
        stamp,
      )
    })
  }
}
