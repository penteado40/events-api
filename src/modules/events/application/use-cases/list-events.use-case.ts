import type { EventStatus } from '../../domain/event.entity.js'
import type { EventRepository, EventWithMembership } from '../../domain/event.repository.js'
import type { Requester } from '../requester.js'

export interface ListEventsInput {
  actor: Requester
  status?: EventStatus
}

export type ListEventsOutput = EventWithMembership[]

/** The Super admin sees every Event; anyone else, only the Events they are a member of. */
export class ListEventsUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(input: ListEventsInput): Promise<ListEventsOutput> {
    const filter = input.status ? { status: input.status } : {}
    if (!input.actor.isSuperAdmin) return this.events.listForMember(input.actor.id, filter)

    const events = await this.events.listAll(filter)
    return events.map((event) => ({ event, membership: null }))
  }
}
