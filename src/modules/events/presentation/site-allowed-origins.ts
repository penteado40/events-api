import { AllowedOrigins } from '../../../shared/presentation/allowed-origins.js'
import { CorsOrigins } from '../application/cors-origins.js'

/** Lets CORS accept the Events' siteUrls and the extra origins from the env. */
export class SiteAllowedOrigins extends AllowedOrigins {
  constructor(private readonly corsOrigins: CorsOrigins) {
    super()
  }

  isAllowed(origin: string): Promise<boolean> {
    return this.corsOrigins.isAllowed(origin)
  }
}
