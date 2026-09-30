import type { Scope } from '../domain/scope.js'

/** The Site, as the events context sees it after its API token was checked. */
export interface SiteCredential {
  apiTokenId: number
  eventId: number
  scopes: Scope[]
}
