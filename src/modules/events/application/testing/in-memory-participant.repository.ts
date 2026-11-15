import type { Stamp } from '../../../../shared/domain/stamp.js'
import { ParticipantRepository } from '../../domain/participant.repository.js'
import type { InMemoryEventRepository } from './in-memory-event.repository.js'

export class InMemoryParticipantRepository extends ParticipantRepository {
  private participants: { eventId: number; userId: number; stamp: Stamp }[] = []

  /** The Events, to know the Group of each one. */
  constructor(private readonly events: InMemoryEventRepository) {
    super()
  }

  async create(eventId: number, userIds: readonly number[], stamp: Stamp): Promise<void> {
    for (const userId of userIds) this.participants.push({ eventId, userId, stamp })
  }

  async remove(eventId: number, userId: number): Promise<void> {
    this.participants = this.participants.filter(
      (p) => p.eventId !== eventId || p.userId !== userId,
    )
  }

  async findByEvent(eventId: number): Promise<number[]> {
    return this.participants.filter((p) => p.eventId === eventId).map((p) => p.userId)
  }

  async isParticipant(eventId: number, userId: number): Promise<boolean> {
    return this.participants.some((p) => p.eventId === eventId && p.userId === userId)
  }

  async findByUser(userId: number): Promise<{ groupId: number; eventId: number }[]> {
    const eventIds = this.participants
      .filter((p) => p.userId === userId)
      .map((p) => p.eventId)
      .sort((a, b) => a - b)
    const found = await Promise.all(eventIds.map((id) => this.events.findById(id)))
    return found.flatMap((event) => (event ? [{ groupId: event.groupId, eventId: event.id }] : []))
  }

  /** Who added the Participants of the Event, and when. Helper for test assertions. */
  stampsOf(eventId: number): Stamp[] {
    return this.participants.filter((p) => p.eventId === eventId).map((p) => p.stamp)
  }
}
