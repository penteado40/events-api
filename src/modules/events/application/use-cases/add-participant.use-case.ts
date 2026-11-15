import { AppError } from '../../../../shared/domain/app-error.js'
import { participantJoined } from '../../domain/participant-changes.js'
import type { ActingUser } from '../actor.js'
import { changeParticipants, type ParticipantWriteDeps } from '../participant-list-change.js'

export interface AddParticipantInput {
  actor: ActingUser
  eventId: number
  userId: number
}

/**
 * An Owner of its Group, or the Super admin, adds a Group member of that
 * Group (Owner or Viewer) to the Participants of the Event; anyone else is
 * NOT_FOUND. Adding who is already a Participant changes nothing and writes
 * nothing. The entry is a Change that only the production sees, written with
 * it (changeParticipants).
 */
export class AddParticipantUseCase {
  constructor(private readonly deps: ParticipantWriteDeps) {}

  async execute(input: AddParticipantInput): Promise<void> {
    const { participants } = this.deps
    await changeParticipants(
      this.deps,
      input.actor,
      input.eventId,
      async ({ eventId, members, reach, stamp }) => {
        if (!members.some((m) => m.userId === input.userId)) throw new AppError('NOT_FOUND')
        if (await participants.isParticipant(eventId, input.userId)) return null
        await participants.create(eventId, [input.userId], stamp)
        return participantJoined(input.userId, reach)
      },
    )
  }
}
