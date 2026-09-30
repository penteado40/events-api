import { AppError } from '../../../shared/domain/app-error.js'
import type { EventAction } from '../domain/access-policy.js'
import type { ApiToken } from '../domain/api-token.entity.js'
import type { ApiTokenRepository } from '../domain/api-token.repository.js'
import type { EventRepository } from '../domain/event.repository.js'
import { loadEventFor } from './event-access.js'
import type { Requester } from './requester.js'

/**
 * Asks the AccessPolicy about the Event first, so only who may see its tokens
 * learns whether one exists; a token of another Event is API_TOKEN_NOT_FOUND.
 */
export async function loadApiTokenFor(
  events: EventRepository,
  apiTokens: ApiTokenRepository,
  actor: Requester,
  eventId: number,
  apiTokenId: number,
  action: Extract<EventAction, `api-token:${string}`>,
): Promise<ApiToken> {
  await loadEventFor(events, actor, eventId, action)
  const apiToken = await apiTokens.findInEvent(eventId, apiTokenId)
  if (!apiToken) throw new AppError('API_TOKEN_NOT_FOUND')
  return apiToken
}
