import { AppError } from '../../../../shared/domain/app-error.js'
import { AccessPolicy } from '../../domain/access-policy.js'
import type { Event } from '../../domain/event.entity.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'
import type { SiteCredential } from '../site-credential.js'

export interface GetPublicEventInput {
  /** The Site through its API token, or a member previewing what the Site reads. */
  actor: SiteCredential | Requester
  eventId: number
}

export type GetPublicEventOutput = Event

export class GetPublicEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(input: GetPublicEventInput): Promise<GetPublicEventOutput> {
    const { actor, eventId } = input
    if (!('apiTokenId' in actor)) {
      return (await loadEventFor(this.events, actor, eventId, 'event:read-public')).event
    }
    // A token never learns whether another Event exists.
    if (actor.eventId !== eventId) throw new AppError('FORBIDDEN')
    const event = await this.events.findById(eventId)
    if (!event) throw new AppError('FORBIDDEN')
    AccessPolicy.assert({ apiToken: actor }, 'event:read-public', event)
    return event
  }
}
