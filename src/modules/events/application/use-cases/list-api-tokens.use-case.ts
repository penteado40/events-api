import type { ApiToken } from '../../domain/api-token.entity.js'
import type { ApiTokenRepository } from '../../domain/api-token.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'

export interface ListApiTokensInput {
  actor: Requester
  eventId: number
}

export type ListApiTokensOutput = ApiToken[]

export class ListApiTokensUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly apiTokens: ApiTokenRepository,
  ) {}

  async execute(input: ListApiTokensInput): Promise<ListApiTokensOutput> {
    await loadEventFor(this.events, input.actor, input.eventId, 'api-token:read')
    return this.apiTokens.listByEvent(input.eventId)
  }
}
