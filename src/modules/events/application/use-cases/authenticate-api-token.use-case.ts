import type { Clock } from '../../../../shared/application/clock.js'
import type { SecretTokens } from '../../../../shared/application/secret-tokens.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ApiTokenRepository } from '../../domain/api-token.repository.js'
import type { SiteCredential } from '../site-credential.js'

export interface AuthenticateApiTokenInput {
  value: string
}

export type AuthenticateApiTokenOutput = SiteCredential

/**
 * Checks the `X-Api-Key` of a request. Unknown and inactive tokens answer the
 * same, so a guess learns nothing. The last use is stored at most once per
 * window, not on every request of the Site.
 */
export class AuthenticateApiTokenUseCase {
  constructor(
    private readonly apiTokens: ApiTokenRepository,
    private readonly secrets: SecretTokens,
    private readonly clock: Clock,
  ) {}

  async execute(input: AuthenticateApiTokenInput): Promise<AuthenticateApiTokenOutput> {
    if (!input.value) throw new AppError('UNAUTHENTICATED')
    const apiToken = await this.apiTokens.findByHash(this.secrets.hash(input.value))
    if (!apiToken?.isActive) throw new AppError('UNAUTHENTICATED')

    if (apiToken.recordUse(this.clock.now())) await this.apiTokens.saveLastUse(apiToken)
    return { apiTokenId: apiToken.id, eventId: apiToken.eventId, scopes: apiToken.scopes }
  }
}
