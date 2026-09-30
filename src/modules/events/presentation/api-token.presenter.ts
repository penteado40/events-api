import type { ApiToken } from '../domain/api-token.entity.js'
import type { ApiTokenJson } from './dto/api-token.dto.js'

/** Never the value nor its hash. */
export const ApiTokenPresenter = {
  toJson(apiToken: ApiToken): ApiTokenJson {
    return {
      id: apiToken.id,
      eventId: apiToken.eventId,
      name: apiToken.name,
      scopes: apiToken.scopes,
      isActive: apiToken.isActive,
      lastUsedAt: apiToken.lastUsedAt?.toISOString() ?? null,
      createdAt: apiToken.createdAt.toISOString(),
      updatedAt: apiToken.updatedAt.toISOString(),
    }
  },
}
