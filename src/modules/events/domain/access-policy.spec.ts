import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { type AccessDecision, AccessPolicy, type Actor, type EventAction } from './access-policy.js'

const superAdmin: Actor = { isSuperAdmin: true, membership: null }
const primaryOwner: Actor = {
  isSuperAdmin: false,
  membership: { role: 'OWNER', isPrimaryOwner: true },
}
const owner: Actor = { isSuperAdmin: false, membership: { role: 'OWNER', isPrimaryOwner: false } }
const manager: Actor = {
  isSuperAdmin: false,
  membership: { role: 'MANAGER', isPrimaryOwner: false },
}
const viewer: Actor = { isSuperAdmin: false, membership: { role: 'VIEWER', isPrimaryOwner: false } }
const nonMember: Actor = { isSuperAdmin: false, membership: null }

const ALLOWED: AccessDecision = { allowed: true }
const FORBIDDEN: AccessDecision = { allowed: false, code: 'FORBIDDEN' }
const ARCHIVED: AccessDecision = { allowed: false, code: 'EVENT_ARCHIVED' }

const ACTORS = { superAdmin, primaryOwner, owner, manager, viewer, nonMember }
type ActorName = keyof typeof ACTORS

/** Expected decision per action, for [superAdmin, primaryOwner, owner, manager, viewer, nonMember]. */
type Row = [
  AccessDecision,
  AccessDecision,
  AccessDecision,
  AccessDecision,
  AccessDecision,
  AccessDecision,
]

const ACTIVE_EVENT: Record<EventAction, Row> = {
  'event:read': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'event:update': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN],
  'event:update-site': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'event:archive': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'event:unarchive': [ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'member:read': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'member:manage': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'member:leave': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
}

// Frozen (ADR-0011): only the Super admin writes. The role is checked before the
// status, so whoever could not write anyway still gets FORBIDDEN. Archiving an
// archived event changes nothing, so it stays allowed (idempotent).
const ARCHIVED_EVENT: Record<EventAction, Row> = {
  'event:read': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'event:update': [ALLOWED, ARCHIVED, ARCHIVED, ARCHIVED, FORBIDDEN, FORBIDDEN],
  'event:update-site': [ALLOWED, ARCHIVED, ARCHIVED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'event:archive': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'event:unarchive': [ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'member:read': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'member:manage': [ALLOWED, ARCHIVED, ARCHIVED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'member:leave': [ALLOWED, ARCHIVED, ARCHIVED, ARCHIVED, ARCHIVED, FORBIDDEN],
}

function cases(matrix: Record<EventAction, Row>) {
  const names = Object.keys(ACTORS) as ActorName[]
  return (Object.entries(matrix) as [EventAction, Row][]).flatMap(([action, row]) =>
    names.map((name, i) => ({ action, name, expected: row[i] as AccessDecision })),
  )
}

describe('AccessPolicy', () => {
  describe.each([
    { status: 'ACTIVE' as const, matrix: ACTIVE_EVENT },
    { status: 'ARCHIVED' as const, matrix: ARCHIVED_EVENT },
  ])('on an $status event', ({ status, matrix }) => {
    it.each(cases(matrix))('$action by $name → $expected', ({ action, name, expected }) => {
      expect(AccessPolicy.decide(ACTORS[name], action, { status })).toEqual(expected)
    })
  })

  // UpdateEventUseCase asks only for event:update-site when a siteUrl is sent,
  // so whoever may change the site must also be allowed the plain update.
  it('never grants event:update-site to an actor it refuses event:update', () => {
    for (const [name, actor] of Object.entries(ACTORS)) {
      const site = AccessPolicy.decide(actor, 'event:update-site', { status: 'ACTIVE' })
      const update = AccessPolicy.decide(actor, 'event:update', { status: 'ACTIVE' })
      if (site.allowed) expect(update, name).toEqual(ALLOWED)
    }
  })

  it('lets only the Super admin create events', () => {
    expect(AccessPolicy.decide(superAdmin, 'event:create')).toEqual(ALLOWED)
    expect(AccessPolicy.decide(nonMember, 'event:create')).toEqual(FORBIDDEN)
  })

  it('assert throws the AppError of a refused decision and returns quietly otherwise', () => {
    expect(() => AccessPolicy.assert(viewer, 'event:update', { status: 'ACTIVE' })).toThrow(
      new AppError('FORBIDDEN'),
    )
    expect(() => AccessPolicy.assert(owner, 'event:update', { status: 'ARCHIVED' })).toThrow(
      new AppError('EVENT_ARCHIVED'),
    )
    expect(() => AccessPolicy.assert(owner, 'event:update', { status: 'ACTIVE' })).not.toThrow()
  })
})
