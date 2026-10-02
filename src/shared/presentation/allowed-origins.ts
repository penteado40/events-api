/**
 * Decides whether CORS lets a browser at `origin` read the API's responses.
 * The context that owns the Events provides it (their siteUrls, ADR-0007).
 */
export abstract class AllowedOrigins {
  abstract isAllowed(origin: string): Promise<boolean>
}
