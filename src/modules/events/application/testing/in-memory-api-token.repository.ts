import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { ApiToken, type NewApiTokenProps } from '../../domain/api-token.entity.js'
import { ApiTokenRepository } from '../../domain/api-token.repository.js'

export class InMemoryApiTokenRepository extends ApiTokenRepository {
  private readonly tokens = new Map<number, ApiToken>()
  private nextId = 1

  async create(props: NewApiTokenProps, stamp: Stamp): Promise<ApiToken> {
    const apiToken = ApiToken.restore({
      ...props,
      id: this.nextId++,
      isActive: true,
      lastUsedAt: null,
      ...createdWith(stamp),
    })
    this.tokens.set(apiToken.id, apiToken)
    return copy(apiToken)
  }

  async findInEvent(eventId: number, apiTokenId: number): Promise<ApiToken | null> {
    const apiToken = this.tokens.get(apiTokenId)
    return apiToken && apiToken.eventId === eventId ? copy(apiToken) : null
  }

  async findByHash(tokenHash: string): Promise<ApiToken | null> {
    const apiToken = [...this.tokens.values()].find((t) => t.tokenHash === tokenHash)
    return apiToken ? copy(apiToken) : null
  }

  async listByEvent(eventId: number): Promise<ApiToken[]> {
    return [...this.tokens.values()].filter((t) => t.eventId === eventId).map(copy)
  }

  async save(apiToken: ApiToken): Promise<void> {
    this.tokens.set(apiToken.id, copy(apiToken))
  }

  async delete(apiToken: ApiToken): Promise<void> {
    this.tokens.delete(apiToken.id)
  }

  async saveLastUse(apiToken: ApiToken): Promise<void> {
    const stored = this.tokens.get(apiToken.id)
    if (!stored) return
    this.tokens.set(
      apiToken.id,
      ApiToken.restore({ ...propsOf(stored), lastUsedAt: apiToken.lastUsedAt }),
    )
  }
}

/** Each read gets its own entity, as each request would from the database. */
function copy(apiToken: ApiToken): ApiToken {
  return ApiToken.restore(propsOf(apiToken))
}

function propsOf(apiToken: ApiToken) {
  return {
    id: apiToken.id,
    eventId: apiToken.eventId,
    name: apiToken.name,
    tokenHash: apiToken.tokenHash,
    scopes: apiToken.scopes,
    isActive: apiToken.isActive,
    lastUsedAt: apiToken.lastUsedAt,
    createdAt: apiToken.createdAt,
    updatedAt: apiToken.updatedAt,
    createdById: apiToken.createdById,
    updatedById: apiToken.updatedById,
  }
}
