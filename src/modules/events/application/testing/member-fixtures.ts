import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import type { Event } from '../../domain/event.entity.js'
import type { Requester } from '../requester.js'
import { newEventProps } from './event-fixtures.js'
import { FakeMemberAccounts } from './fake-member-accounts.js'
import { FakeUserDirectory } from './fake-user-directory.js'
import { InMemoryEventRepository } from './in-memory-event.repository.js'

export const MEMBER_NOW = new Date('2026-09-29T12:00:00.000Z')

/** Who asks, in the Event that `memberScenario` arranges. */
export const as = {
  superAdmin: { id: 1, isSuperAdmin: true },
  primary: { id: 10, isSuperAdmin: false },
  organizer: { id: 11, isSuperAdmin: false },
  manager: { id: 12, isSuperAdmin: false },
  viewer: { id: 13, isSuperAdmin: false },
  stranger: { id: 14, isSuperAdmin: false },
} satisfies Record<string, Requester>

/**
 * An Event with a Primary owner (10), an Owner organizador (11), a Manager (12)
 * and a Viewer (13); 14 is a User of no Event and 1 the Super admin.
 */
export async function memberScenario() {
  const events = new InMemoryEventRepository()
  const users = new FakeUserDirectory()
  const accounts = new FakeMemberAccounts(users)
  const clock = new FixedClock(MEMBER_NOW)

  users.add({ id: 1, name: 'Admin', email: 'admin@example.com', isSuperAdmin: true })
  for (const id of [10, 11, 12, 13, 14]) users.add({ id })

  const event: Event = await events.create(newEventProps(), 10, {
    by: 1,
    at: new Date('2026-09-01T12:00:00.000Z'),
  })
  events.addMember(event.id, 11, { role: 'OWNER', isPrimaryOwner: false })
  events.addMember(event.id, 12, { role: 'MANAGER', isPrimaryOwner: false })
  events.addMember(event.id, 13, { role: 'VIEWER', isPrimaryOwner: false })

  return { events, users, accounts, clock, event }
}

/** `[userId, role, isPrimaryOwner]` of each member, to compare an Event's members at a glance. */
export async function memberRows(events: InMemoryEventRepository, eventId: number) {
  return (await events.listMembers(eventId)).map((m) => [m.userId, m.role, m.isPrimaryOwner])
}
