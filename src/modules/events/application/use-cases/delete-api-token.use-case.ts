import type { ApiTokenRepository } from '../../domain/api-token.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import { loadApiTokenFor } from '../api-token-access.js'
import type { Requester } from '../requester.js'

export interface DeleteApiTokenInput {
  actor: Requester
  eventId: number
  apiTokenId: number
}

/** Revoking for good; nothing refers to a token, so nothing is left behind. */
export class DeleteApiTokenUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly apiTokens: ApiTokenRepository,
  ) {}

  async execute(input: DeleteApiTokenInput): Promise<void> {
    const apiToken = await loadApiTokenFor(
      this.events,
      this.apiTokens,
      input.actor,
      input.eventId,
      input.apiTokenId,
      'api-token:revoke',
    )
    await this.apiTokens.delete(apiToken)
  }
}
