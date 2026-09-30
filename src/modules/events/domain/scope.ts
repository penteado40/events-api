/**
 * What an API token may do on its Event. A Scope only reaches what is public;
 * `event:read` reads the public part of the Event, never what members see.
 */
export const SCOPES = ['event:read', 'rsvp:create', 'registry:read', 'contribution:create'] as const
export type Scope = (typeof SCOPES)[number]
