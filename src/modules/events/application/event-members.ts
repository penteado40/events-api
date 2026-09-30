import { AppError } from '../../../shared/domain/app-error.js'
import type { EventMember, Membership } from '../domain/event-member.js'
import type { EventRepository } from '../domain/event.repository.js'
import type { MemberActor } from '../domain/membership-rules.js'
import type { DirectoryUser, UserDirectory } from './ports/user-directory.js'
import type { Requester } from './requester.js'

/** An Event member with the User behind the link. */
export interface EventMemberView {
  member: EventMember
  user: DirectoryUser
}

export function memberActor(actor: Requester, membership: Membership | null): MemberActor {
  return { userId: actor.id, isSuperAdmin: actor.isSuperAdmin, membership }
}

export async function findMemberOrThrow(
  events: EventRepository,
  eventId: number,
  userId: number,
): Promise<EventMember> {
  const member = await events.findMember(eventId, userId)
  if (!member) throw new AppError('MEMBER_NOT_FOUND')
  return member
}

/** Joins each member with their User; a User is never deleted (ADR-0013), so all are found. */
export async function withUsers(
  users: UserDirectory,
  members: EventMember[],
): Promise<EventMemberView[]> {
  const found = await users.findManyByIds(members.map((m) => m.userId))
  const byId = new Map(found.map((u) => [u.id, u]))
  return members.map((member) => {
    const user = byId.get(member.userId)
    if (!user) throw new Error(`User ${member.userId} of an Event member not found`)
    return { member, user }
  })
}
