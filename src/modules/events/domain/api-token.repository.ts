import type { Stamp } from '../../../shared/domain/stamp.js'
import type { ApiToken, NewApiTokenProps } from './api-token.entity.js'

export abstract class ApiTokenRepository {
  abstract create(props: NewApiTokenProps, stamp: Stamp): Promise<ApiToken>
  /** The token only if it belongs to the Event. */
  abstract findInEvent(eventId: number, apiTokenId: number): Promise<ApiToken | null>
  abstract findByHash(tokenHash: string): Promise<ApiToken | null>
  /** The Event's tokens, oldest first. */
  abstract listByEvent(eventId: number): Promise<ApiToken[]>
  abstract save(apiToken: ApiToken): Promise<void>
  abstract delete(apiToken: ApiToken): Promise<void>
  /** Stores only `lastUsedAt`, leaving the authorship of the last edit alone. */
  abstract saveLastUse(apiToken: ApiToken): Promise<void>
}
