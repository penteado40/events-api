export const EVENT_ROLES = ['OWNER', 'MANAGER', 'VIEWER'] as const
export type EventRole = (typeof EVENT_ROLES)[number]

/** A User's link to one Event. The Primary owner is always an Owner (ADR-0003). */
export interface Membership {
  role: EventRole
  isPrimaryOwner: boolean
}
