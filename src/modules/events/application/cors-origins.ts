import type { Clock } from '../../../shared/application/clock.js'
import type { EventRepository } from '../domain/event.repository.js'

/** How long a loaded list of siteUrls is trusted: a new Event works within a minute. */
const TTL_MS = 60_000
/** After a failed reload, how long to keep the last good list before trying again. */
const RETRY_MS = 5_000

export interface CorsOriginsOptions {
  /** Exact origins from `CORS_ORIGINS` (e.g. the Panel), always accepted. */
  extraOrigins: string[]
}

/**
 * The origins CORS accepts: the siteUrl of every Event, active or archived
 * (ADR-0007, ADR-0011), plus the extra origins from the env. The siteUrls
 * are cached per instance; a failed reload keeps the last good list (only the
 * extra origins, before the first load) so a database outage never closes CORS.
 */
export class CorsOrigins {
  private siteUrls = new Set<string>()
  private expiresAt = 0
  private reloading: Promise<void> | null = null

  constructor(
    private readonly events: EventRepository,
    private readonly clock: Clock,
    private readonly options: CorsOriginsOptions,
  ) {}

  async isAllowed(origin: string): Promise<boolean> {
    if (this.options.extraOrigins.includes(origin)) return true
    const siteUrls = await this.currentSiteUrls()
    return siteUrls.has(origin)
  }

  private async currentSiteUrls(): Promise<Set<string>> {
    if (this.clock.now().getTime() >= this.expiresAt) {
      // Requests that arrive while a reload runs wait for that same one.
      this.reloading ??= this.reload().finally(() => (this.reloading = null))
      await this.reloading
    }
    return this.siteUrls
  }

  private async reload(): Promise<void> {
    try {
      this.siteUrls = new Set(await this.events.listSiteUrls())
      this.expiresAt = this.clock.now().getTime() + TTL_MS
    } catch {
      this.expiresAt = this.clock.now().getTime() + RETRY_MS
    }
  }
}
