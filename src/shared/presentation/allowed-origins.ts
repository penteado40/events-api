/**
 * Decides whether CORS lets a browser at `origin` read the API's responses.
 */
export abstract class AllowedOrigins {
  abstract isAllowed(origin: string): Promise<boolean>
}

/** The origins listed in `CORS_ORIGINS` (e.g. the Panel), and only them. */
export class ConfiguredAllowedOrigins extends AllowedOrigins {
  private readonly origins: ReadonlySet<string>

  constructor(origins: readonly string[]) {
    super()
    this.origins = new Set(origins)
  }

  isAllowed(origin: string): Promise<boolean> {
    return Promise.resolve(this.origins.has(origin))
  }
}
