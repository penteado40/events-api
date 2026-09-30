import { ApiTokenAuthenticator } from '../../../shared/presentation/api-token.js'
import { AuthenticateApiTokenUseCase } from '../application/use-cases/authenticate-api-token.use-case.js'
import type { SiteCredential } from '../application/site-credential.js'

/** Lets the global guard check an `X-Api-Key` against the Event's API tokens. */
export class SiteApiTokenAuthenticator extends ApiTokenAuthenticator {
  constructor(private readonly authenticateApiToken: AuthenticateApiTokenUseCase) {
    super()
  }

  authenticate(value: string): Promise<SiteCredential> {
    return this.authenticateApiToken.execute({ value })
  }
}
