import type { EventRepository, EventWithMembership } from '../../domain/event.repository.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'

export interface UnarchiveEventInput {
  actor: Requester
  eventId: number
}

export type UnarchiveEventOutput = EventWithMembership

/** Only the Super admin brings an Archived event back to active. Idempotent. */
export class UnarchiveEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(input: UnarchiveEventInput): Promise<UnarchiveEventOutput> {
    const result = await loadEventFor(this.events, input.actor, input.eventId, 'event:unarchive')
    if (result.event.unarchive()) await this.events.save(result.event)
    return result
  }
}
