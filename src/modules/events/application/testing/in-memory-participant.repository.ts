import type { Stamp } from '../../../../shared/domain/stamp.js'
import { ParticipantRepository } from '../../domain/participant.repository.js'

export class InMemoryParticipantRepository extends ParticipantRepository {
  private readonly participants: { eventId: number; userId: number; stamp: Stamp }[] = []

  async addMany(eventId: number, userIds: readonly number[], stamp: Stamp): Promise<void> {
    for (const userId of userIds) this.participants.push({ eventId, userId, stamp })
  }

  async findByEvent(eventId: number): Promise<number[]> {
    return this.participants.filter((p) => p.eventId === eventId).map((p) => p.userId)
  }

  async isParticipant(eventId: number, userId: number): Promise<boolean> {
    return this.participants.some((p) => p.eventId === eventId && p.userId === userId)
  }

  /** Who added the Participants of the Event, and when. Helper for test assertions. */
  stampsOf(eventId: number): Stamp[] {
    return this.participants.filter((p) => p.eventId === eventId).map((p) => p.stamp)
  }
}
