import { AppError } from '../../../shared/domain/app-error.js'
import type { EventStatus } from './event.entity.js'
import type { Membership } from './event-member.js'

export type EventAction =
  'event:read' | 'event:update' | 'event:update-site' | 'event:archive' | 'event:unarchive'

export type PlatformAction = 'event:create'

/** Who is asking: a User, with their Membership in the Event at hand (if any). */
export interface Actor {
  isSuperAdmin: boolean
  membership: Membership | null
}

export interface EventState {
  status: EventStatus
}

export type AccessDecision =
  { allowed: true } | { allowed: false; code: 'FORBIDDEN' | 'EVENT_ARCHIVED' }

const ALLOWED: AccessDecision = { allowed: true }
const FORBIDDEN: AccessDecision = { allowed: false, code: 'FORBIDDEN' }
const ARCHIVED: AccessDecision = { allowed: false, code: 'EVENT_ARCHIVED' }

interface Rule {
  roles: Membership['role'][]
  /** A write refused on an Archived event (ADR-0011). */
  write: boolean
}

// The Super admin can do everything and never is an Event member; the rules
// below are for members. Archiving an archived event changes nothing, so it is
// not a write that the freeze refuses.
const RULES: Record<EventAction, Rule> = {
  'event:read': { roles: ['OWNER', 'MANAGER', 'VIEWER'], write: false },
  'event:update': { roles: ['OWNER', 'MANAGER'], write: true },
  'event:update-site': { roles: ['OWNER'], write: true },
  'event:archive': { roles: ['OWNER'], write: false },
  'event:unarchive': { roles: [], write: true },
}

/** Decides every access to an Event (ADR-0003, ADR-0011). No controller decides on its own. */
export const AccessPolicy = {
  decide(actor: Actor, action: EventAction | PlatformAction, event?: EventState): AccessDecision {
    if (actor.isSuperAdmin) return ALLOWED
    if (action === 'event:create' || !event) return FORBIDDEN

    const rule = RULES[action]
    if (!actor.membership || !rule.roles.includes(actor.membership.role)) return FORBIDDEN
    if (rule.write && event.status === 'ARCHIVED') return ARCHIVED
    return ALLOWED
  },

  /** Throws the AppError of a refused decision. */
  assert(actor: Actor, action: EventAction | PlatformAction, event?: EventState): void {
    const decision = AccessPolicy.decide(actor, action, event)
    if (!decision.allowed) throw new AppError(decision.code)
  },
}
