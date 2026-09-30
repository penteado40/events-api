import { AppError } from '../../../shared/domain/app-error.js'
import type { EventStatus } from './event.entity.js'
import type { Membership } from './event-member.js'
import type { Scope } from './scope.js'

/** What the Site may do, each unlocked by one Scope; members may too, by role. */
export type PublicAction =
  'event:read-public' | 'registry:read' | 'rsvp:create' | 'contribution:create'

export type EventAction =
  | 'event:read'
  | 'event:update'
  | 'event:update-site'
  | 'event:archive'
  | 'event:unarchive'
  | 'member:read'
  | 'member:manage'
  | 'member:leave'
  | 'api-token:read'
  | 'api-token:manage'
  | 'api-token:revoke'
  | PublicAction

export type PlatformAction = 'event:create'

/** A User, with their Membership in the Event at hand (if any). */
export interface MemberActor {
  isSuperAdmin: boolean
  membership: Membership | null
}

/** The Site, through an API token of one Event. */
export interface SiteActor {
  apiToken: { eventId: number; scopes: readonly Scope[] }
}

/** Who is asking. */
export type Actor = MemberActor | SiteActor

export interface EventState {
  id: number
  status: EventStatus
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; code: 'FORBIDDEN' | 'EVENT_ARCHIVED' | 'INSUFFICIENT_SCOPE' }

const ALLOWED: AccessDecision = { allowed: true }
const FORBIDDEN: AccessDecision = { allowed: false, code: 'FORBIDDEN' }
const ARCHIVED: AccessDecision = { allowed: false, code: 'EVENT_ARCHIVED' }
const INSUFFICIENT_SCOPE: AccessDecision = { allowed: false, code: 'INSUFFICIENT_SCOPE' }

interface Rule {
  roles: Membership['role'][]
  /** A write refused on an Archived event (ADR-0011). */
  write: boolean
  /** The Scope that lets the Site do it; without one, the Site never may. */
  scope?: Scope
}

// The Super admin can do everything and never is an Event member; the rules
// below are for members and the Site. Archiving an archived event, and revoking
// an API token, change nothing the freeze protects, so they are not writes it
// refuses.
const RULES: Record<EventAction, Rule> = {
  'event:read': { roles: ['OWNER', 'MANAGER', 'VIEWER'], write: false },
  'event:update': { roles: ['OWNER', 'MANAGER'], write: true },
  'event:update-site': { roles: ['OWNER'], write: true },
  'event:archive': { roles: ['OWNER'], write: false },
  'event:unarchive': { roles: [], write: true },
  'member:read': { roles: ['OWNER', 'MANAGER', 'VIEWER'], write: false },
  // Who may change which member is the MembershipRules' call (ADR-0003).
  'member:manage': { roles: ['OWNER'], write: true },
  'member:leave': { roles: ['OWNER', 'MANAGER', 'VIEWER'], write: true },
  'api-token:read': { roles: ['OWNER'], write: false },
  'api-token:manage': { roles: ['OWNER'], write: true },
  'api-token:revoke': { roles: ['OWNER'], write: false },
  'event:read-public': {
    roles: ['OWNER', 'MANAGER', 'VIEWER'],
    write: false,
    scope: 'event:read',
  },
  'registry:read': { roles: ['OWNER', 'MANAGER', 'VIEWER'], write: false, scope: 'registry:read' },
  'rsvp:create': { roles: [], write: true, scope: 'rsvp:create' },
  'contribution:create': { roles: [], write: true, scope: 'contribution:create' },
}

/** Decides every access to an Event (ADR-0003, ADR-0011). No controller decides on its own. */
export const AccessPolicy = {
  decide(actor: Actor, action: EventAction | PlatformAction, event?: EventState): AccessDecision {
    if ('apiToken' in actor) return decideForSite(actor, action, event)
    if (actor.isSuperAdmin) return ALLOWED
    if (action === 'event:create' || !event) return FORBIDDEN

    const rule = RULES[action]
    if (!actor.membership || !rule.roles.includes(actor.membership.role)) return FORBIDDEN
    return frozen(rule, event) ? ARCHIVED : ALLOWED
  },

  /** Throws the AppError of a refused decision. */
  assert(actor: Actor, action: EventAction | PlatformAction, event?: EventState): void {
    const decision = AccessPolicy.decide(actor, action, event)
    if (!decision.allowed) throw new AppError(decision.code)
  },
}

/**
 * Another Event is FORBIDDEN before anything else, so a token learns nothing
 * about it; the Scope is checked before the state, like the role for members.
 */
function decideForSite(
  { apiToken }: SiteActor,
  action: EventAction | PlatformAction,
  event?: EventState,
): AccessDecision {
  if (action === 'event:create' || !event || event.id !== apiToken.eventId) return FORBIDDEN
  const rule = RULES[action]
  if (!rule.scope) return FORBIDDEN
  if (!apiToken.scopes.includes(rule.scope)) return INSUFFICIENT_SCOPE
  return frozen(rule, event) ? ARCHIVED : ALLOWED
}

function frozen(rule: Rule, event: EventState): boolean {
  return rule.write && event.status === 'ARCHIVED'
}
