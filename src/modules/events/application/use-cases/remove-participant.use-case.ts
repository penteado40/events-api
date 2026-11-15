import type { Clock } from '../../../../shared/application/clock.js'
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ChangeRepository } from '../../domain/change.repository.js'
import { eventReach } from '../../domain/event-reach.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { participantLeft } from '../../domain/participant-changes.js'
import type { ParticipantRepository } from '../../domain/participant.repository.js'
import type { ActingUser } from '../actor.js'
import { requireEventsEditor } from '../event-access.js'
import type { GroupDirectory } from '../ports/group-directory.js'

export interface RemoveParticipantInput {
  actor: ActingUser
  eventId: number
  userId: number
}

/**
 * An Owner of its Group, or the Super admin, takes a Participant off the list
 * of the Event, an Owner or one who is no longer a Group member included; who
 * is not a Participant is NOT_FOUND. A Cancelled Event is frozen:
 * EVENT_CANCELLED. Who leaves stops being reached by the Event's items with
 * the Audience "Todos"; leaving the chosen Audiences and staying in the
 * Fields of people, marked as out of the Event, come with them (CONTEXT.md,
 * Participant).
 *
 * The exit is a Change that only the production sees, written in the same
 * unit of work (amendment of ADR-0010), under the Group's and the Event's
 * locks, like AddParticipantUseCase.
 */
export class RemoveParticipantUseCase {
  constructor(
    private readonly directory: GroupDirectory,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly changeLog: ChangeRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveParticipantInput): Promise<void> {
    const found = await this.events.findById(input.eventId)
    if (!found) throw new AppError('NOT_FOUND')
    await requireEventsEditor(input.actor, found.groupId, this.directory)
    const stamp = { by: input.actor.id, at: this.clock.now() }

    await this.unitOfWork.run(async () => {
      // Locks go Group, then Event, always (see AddParticipantUseCase).
      const members = await this.directory.lockMembers(found.groupId)
      const event = await this.events.lockById(input.eventId)
      if (!event) throw new AppError('NOT_FOUND')
      event.assertWritable()
      if (!(await this.participants.isParticipant(event.id, input.userId))) {
        throw new AppError('NOT_FOUND')
      }
      await this.participants.remove(event.id, input.userId)
      await this.changeLog.create(
        event.id,
        [participantLeft(input.userId, eventReach(members))],
        stamp,
      )
    })
  }
}
