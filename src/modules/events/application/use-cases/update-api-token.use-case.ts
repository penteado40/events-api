import type { Clock } from '../../../../shared/application/clock.js'
import type { ApiToken } from '../../domain/api-token.entity.js'
import type { ApiTokenRepository } from '../../domain/api-token.repository.js'
import type { EventRepository } from '../../domain/event.repository.js'
import type { Scope } from '../../domain/scope.js'
import { loadApiTokenFor } from '../api-token-access.js'
import type { Requester } from '../requester.js'

export interface ApiTokenChanges {
  name?: string
  scopes?: Scope[]
  isActive?: boolean
}

export interface UpdateApiTokenInput {
  actor: Requester
  eventId: number
  apiTokenId: number
  changes: ApiTokenChanges
}

export type UpdateApiTokenOutput = ApiToken

/**
 * Owners rename a token, change its Scopes and turn it on or off; the value
 * stays the same. A request that only deactivates is asked as
 * `api-token:revoke`, which the freeze of an Archived event lets through.
 */
export class UpdateApiTokenUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly apiTokens: ApiTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateApiTokenInput): Promise<UpdateApiTokenOutput> {
    const { name, scopes, isActive } = input.changes
    const onlyDeactivates = isActive === false && name === undefined && scopes === undefined
    const apiToken = await loadApiTokenFor(
      this.events,
      this.apiTokens,
      input.actor,
      input.eventId,
      input.apiTokenId,
      onlyDeactivates ? 'api-token:revoke' : 'api-token:manage',
    )

    const stamp = { by: input.actor.id, at: this.clock.now() }
    if (name !== undefined) apiToken.rename(name, stamp)
    if (scopes !== undefined) apiToken.changeScopes(scopes, stamp)
    if (isActive === true) apiToken.activate(stamp)
    if (isActive === false) apiToken.deactivate(stamp)
    await this.apiTokens.save(apiToken)
    return apiToken
  }
}
