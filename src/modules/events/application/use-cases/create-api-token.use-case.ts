import type { Clock } from '../../../../shared/application/clock.js'
import type { SecretTokens } from '../../../../shared/application/secret-tokens.js'
import { ApiToken } from '../../domain/api-token.entity.js'
import type { ApiTokenRepository } from '../../domain/api-token.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { Scope } from '../../domain/scope.js'
import { loadEventFor } from '../event-access.js'
import type { Requester } from '../requester.js'

/** Makes an API token value recognizable wherever it leaks. */
export const API_TOKEN_PREFIX = 'evt_'

export interface CreateApiTokenInput {
  actor: Requester
  eventId: number
  name: string
  scopes: Scope[]
}

export interface CreateApiTokenOutput {
  apiToken: ApiToken
  /** The only time the value is ever seen. */
  value: string
}

/** Owners (and the Super admin) give the Site of an Event its credential. */
export class CreateApiTokenUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly apiTokens: ApiTokenRepository,
    private readonly secrets: SecretTokens,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateApiTokenInput): Promise<CreateApiTokenOutput> {
    await loadEventFor(this.events, input.actor, input.eventId, 'api-token:manage')
    const { value, hash } = this.secrets.generate(API_TOKEN_PREFIX)
    const props = ApiToken.normalizeNew({
      eventId: input.eventId,
      name: input.name,
      tokenHash: hash,
      scopes: input.scopes,
    })
    const apiToken = await this.apiTokens.create(props, {
      by: input.actor.id,
      at: this.clock.now(),
    })
    return { apiToken, value }
  }
}
