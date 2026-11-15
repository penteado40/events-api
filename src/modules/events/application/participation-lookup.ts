import { EventParticipations, type Participation } from '../../identity/index.js'
import type { ParticipantRepository } from '../domain/participant.repository.js'

/**
 * The Events a User is a Participant of, for identity's /me. identity declares
 * the port (EventParticipations) and events, owner of the data, implements it
 * here, so identity never imports events (docs/arquitetura.md §5.5).
 */
export class ParticipationLookup extends EventParticipations {
  constructor(private readonly participants: ParticipantRepository) {
    super()
  }

  ofUser(userId: number): Promise<Participation[]> {
    return this.participants.findByUser(userId)
  }
}
