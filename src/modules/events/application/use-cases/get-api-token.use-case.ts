import type { ApiToken } from '../../domain/api-token.entity.js'
import type { ApiTokenRepository } from '../../domain/api-token.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { loadApiTokenFor } from '../api-token-access.js'
import type { Requester } from '../requester.js'

export interface GetApiTokenInput {
  actor: Requester
  eventId: number
  apiTokenId: number
}

export type GetApiTokenOutput = ApiToken

export class GetApiTokenUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly apiTokens: ApiTokenRepository,
  ) {}

  execute(input: GetApiTokenInput): Promise<GetApiTokenOutput> {
    return loadApiTokenFor(
      this.events,
      this.apiTokens,
      input.actor,
      input.eventId,
      input.apiTokenId,
      'api-token:read',
    )
  }
}
