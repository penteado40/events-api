import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import {
  type AccessDecision,
  AccessPolicy,
  type Actor,
  type EventAction,
  type EventState,
  type PublicAction,
} from './access-policy.js'
import { SCOPES, type Scope } from './scope.js'

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
const INSUFFICIENT_SCOPE: AccessDecision = { allowed: false, code: 'INSUFFICIENT_SCOPE' }

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
  'api-token:read': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'api-token:manage': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'api-token:revoke': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  // Members preview what the Site reads; Guest writes go through the Site only.
  'event:read-public': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'registry:read': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'rsvp:create': [ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'contribution:create': [ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN],
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
  'api-token:read': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'api-token:manage': [ALLOWED, ARCHIVED, ARCHIVED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  // Revoking only closes access, so the freeze lets Owners do it (ADR-0011).
  'api-token:revoke': [ALLOWED, ALLOWED, ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'event:read-public': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'registry:read': [ALLOWED, ALLOWED, ALLOWED, ALLOWED, ALLOWED, FORBIDDEN],
  'rsvp:create': [ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN],
  'contribution:create': [ALLOWED, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN, FORBIDDEN],
}

const EVENT_ID = 7
const active: EventState = { id: EVENT_ID, status: 'ACTIVE' }
const archived: EventState = { id: EVENT_ID, status: 'ARCHIVED' }

/** The Scope that unlocks each public action. */
const SCOPE_OF: Record<PublicAction, Scope> = {
  'event:read-public': 'event:read',
  'registry:read': 'registry:read',
  'rsvp:create': 'rsvp:create',
  'contribution:create': 'contribution:create',
}
const PUBLIC_ACTIONS = Object.keys(SCOPE_OF) as PublicAction[]
const PUBLIC_WRITES: PublicAction[] = ['rsvp:create', 'contribution:create']

const site = (scopes: readonly Scope[], eventId = EVENT_ID): Actor => ({
  apiToken: { eventId, scopes },
})

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
      expect(AccessPolicy.decide(ACTORS[name], action, { id: EVENT_ID, status })).toEqual(expected)
    })
  })

  // UpdateEventUseCase asks only for event:update-site when a siteUrl is sent,
  // so whoever may change the site must also be allowed the plain update.
  it('never grants event:update-site to an actor it refuses event:update', () => {
    for (const [name, actor] of Object.entries(ACTORS)) {
      const site = AccessPolicy.decide(actor, 'event:update-site', active)
      const update = AccessPolicy.decide(actor, 'event:update', active)
      if (site.allowed) expect(update, name).toEqual(ALLOWED)
    }
  })

  it('lets only the Super admin create events', () => {
    expect(AccessPolicy.decide(superAdmin, 'event:create')).toEqual(ALLOWED)
    expect(AccessPolicy.decide(nonMember, 'event:create')).toEqual(FORBIDDEN)
  })

  describe('the Site, through an API token', () => {
    it.each(PUBLIC_ACTIONS)('is allowed %s only with its Scope', (action) => {
      expect(AccessPolicy.decide(site([SCOPE_OF[action]]), action, active)).toEqual(ALLOWED)
      const others = SCOPES.filter((scope) => scope !== SCOPE_OF[action])
      expect(AccessPolicy.decide(site(others), action, active)).toEqual(INSUFFICIENT_SCOPE)
    })

    it('keeps reading an Archived event, but its writes get EVENT_ARCHIVED', () => {
      for (const action of PUBLIC_ACTIONS) {
        const expected = PUBLIC_WRITES.includes(action) ? ARCHIVED : ALLOWED
        expect(AccessPolicy.decide(site(SCOPES), action, archived), action).toEqual(expected)
      }
      // The Scope is checked before the state, like the role for members.
      expect(AccessPolicy.decide(site([]), 'rsvp:create', archived)).toEqual(INSUFFICIENT_SCOPE)
    })

    it('is refused anything on another Event with FORBIDDEN, whatever its Scopes', () => {
      for (const action of PUBLIC_ACTIONS) {
        expect(AccessPolicy.decide(site(SCOPES, 8), action, active), action).toEqual(FORBIDDEN)
      }
    })

    it('never reaches what members see, even with every Scope', () => {
      for (const action of Object.keys(ACTIVE_EVENT) as EventAction[]) {
        if (PUBLIC_ACTIONS.includes(action as PublicAction)) continue
        expect(AccessPolicy.decide(site(SCOPES), action, active), action).toEqual(FORBIDDEN)
      }
      expect(AccessPolicy.decide(site(SCOPES), 'event:create')).toEqual(FORBIDDEN)
    })
  })

  it('assert throws the AppError of a refused decision and returns quietly otherwise', () => {
    expect(() => AccessPolicy.assert(viewer, 'event:update', active)).toThrow(
      new AppError('FORBIDDEN'),
    )
    expect(() => AccessPolicy.assert(owner, 'event:update', archived)).toThrow(
      new AppError('EVENT_ARCHIVED'),
    )
    expect(() => AccessPolicy.assert(owner, 'event:update', active)).not.toThrow()
  })
})
