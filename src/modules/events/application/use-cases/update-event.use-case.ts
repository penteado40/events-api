import type { Clock } from '../../../../shared/application/clock.js'
import type { EventChanges, EventDetails } from '../../domain/event.entity.js'
import type { EventRepository, EventWithMembership } from '../../domain/event.repository.js'
import { SiteUrl, type SiteUrlOptions } from '../../domain/site-url.vo.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'

export interface UpdateEventInput {
  actor: Requester
  eventId: number
  changes: Partial<EventDetails> & { siteUrl?: string }
}

export type UpdateEventOutput = EventWithMembership

/**
 * Owners and Managers edit the Event. The siteUrl feeds CORS, so a request that
 * sends it is asked as `event:update-site` (Owners only, a subset of
 * `event:update`), and a refusal refuses the whole request.
 */
export class UpdateEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly clock: Clock,
    private readonly siteUrlOptions: SiteUrlOptions,
  ) {}

  async execute(input: UpdateEventInput): Promise<UpdateEventOutput> {
    const { siteUrl, ...details } = input.changes
    const action = siteUrl === undefined ? 'event:update' : 'event:update-site'
    const result = await loadEventFor(this.events, input.actor, input.eventId, action)

    const changes: EventChanges = { ...details }
    if (details.name !== undefined) changes.name = details.name.trim()
    if (siteUrl !== undefined) {
      changes.siteUrl = SiteUrl.create(siteUrl, this.siteUrlOptions)
    }
    result.event.update(changes, { by: input.actor.id, at: this.clock.now() })
    await this.events.save(result.event)
    return result
  }
}
