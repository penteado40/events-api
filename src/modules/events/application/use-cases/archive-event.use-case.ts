import type { EventRepository, EventWithMembership } from '../../domain/event.repository.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'

export interface ArchiveEventInput {
  actor: Requester
  eventId: number
}

export type ArchiveEventOutput = EventWithMembership

/** Owners archive an Event, freezing it (ADR-0011). Idempotent. */
export class ArchiveEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(input: ArchiveEventInput): Promise<ArchiveEventOutput> {
    const result = await loadEventFor(this.events, input.actor, input.eventId, 'event:archive')
    if (result.event.archive()) await this.events.save(result.event)
    return result
  }
}
