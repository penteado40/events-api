import type { EventRepository, EventWithMembership } from '../../domain/event.repository.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'

export interface GetEventInput {
  actor: Requester
  eventId: number
}

export type GetEventOutput = EventWithMembership

export class GetEventUseCase {
  constructor(private readonly events: EventRepository) {}

  execute(input: GetEventInput): Promise<GetEventOutput> {
    return loadEventFor(this.events, input.actor, input.eventId, 'event:read')
  }
}
