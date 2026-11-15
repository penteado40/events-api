import { AppError } from '../../../../shared/domain/app-error.js'
import { participantLeft } from '../../domain/participant-changes.js'
import type { ActingUser } from '../actor.js'
import { changeParticipants, type ParticipantWriteDeps } from '../participant-list-change.js'

export interface RemoveParticipantInput {
  actor: ActingUser
  eventId: number
  userId: number
}

/**
 * An Owner of its Group, or the Super admin, takes a Participant off the list
 * of the Event, an Owner or one who is no longer a Group member included; who
 * is not a Participant is NOT_FOUND. The exit is a Change that only the
 * production sees, written with it (changeParticipants).
 *
 * Who leaves stops being reached by the Event items with the Audience
 * "Todos", since the reach rule reads the Participants. Leaving the chosen
 * Audiences and being marked as out of the Event in the Fields of people
 * (CONTEXT.md, Participant) are for when those exist; neither does yet.
 */
export class RemoveParticipantUseCase {
  constructor(private readonly deps: ParticipantWriteDeps) {}

  async execute(input: RemoveParticipantInput): Promise<void> {
    const { participants } = this.deps
    await changeParticipants(this.deps, input.actor, input.eventId, async ({ eventId, reach }) => {
      if (!(await participants.isParticipant(eventId, input.userId))) {
        throw new AppError('NOT_FOUND')
      }
      await participants.remove(eventId, input.userId)
      return participantLeft(input.userId, reach)
    })
  }
}
