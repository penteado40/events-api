import { AppError } from '../../../shared/domain/app-error.js'
import type { EventRole, Membership } from './event-member.js'

/** Who manages the members: a User, with their Membership in the Event (null for the Super admin). */
export interface MemberActor {
  userId: number
  isSuperAdmin: boolean
  membership: Membership | null
}

/** The Event member being changed. */
export interface MemberTarget {
  userId: number
  membership: Membership
}

/**
 * Who may change which Event member (ADR-0003). Permission is checked before
 * the Primary owner invariant, so a refused actor gets FORBIDDEN, not a hint
 * about the Event's state. The Super admin follows the invariant too: an Event
 * that has a Primary owner never goes without one.
 */
export const MembershipRules = {
  assertCanAdd(actor: MemberActor): void {
    if (!isOwner(actor)) throw new AppError('FORBIDDEN')
  },

  assertCanChangeRole(actor: MemberActor, target: MemberTarget, role: EventRole): void {
    if (!isOwner(actor)) throw new AppError('FORBIDDEN')
    if (role === target.membership.role) return
    if (target.membership.role === 'OWNER' && !isSelf(actor, target)) {
      assertCanOverrule(actor)
    }
    if (target.membership.isPrimaryOwner) throw new AppError('PRIMARY_OWNER_MUST_TRANSFER')
  },

  assertCanRemove(actor: MemberActor, target: MemberTarget): void {
    if (!isSelf(actor, target)) {
      if (!isOwner(actor)) throw new AppError('FORBIDDEN')
      if (target.membership.role === 'OWNER') assertCanOverrule(actor)
    }
    if (target.membership.isPrimaryOwner) throw new AppError('PRIMARY_OWNER_MUST_TRANSFER')
  },

  assertCanTransferPrimary(actor: MemberActor, target: MemberTarget): void {
    assertCanOverrule(actor)
    if (target.membership.role !== 'OWNER') throw new AppError('TRANSFER_TARGET_NOT_OWNER')
  },
}

function isOwner(actor: MemberActor): boolean {
  return actor.isSuperAdmin || actor.membership?.role === 'OWNER'
}

function isSelf(actor: MemberActor, target: MemberTarget): boolean {
  return !actor.isSuperAdmin && actor.userId === target.userId
}

/** Only the Primary owner and the Super admin act on other Owners and on the post. */
function assertCanOverrule(actor: MemberActor): void {
  if (!actor.isSuperAdmin && !actor.membership?.isPrimaryOwner) throw new AppError('FORBIDDEN')
}
