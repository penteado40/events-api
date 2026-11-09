import type { DomainEvent } from '../../../../shared/domain/domain-event.js'

/** A User is no longer a Group member of the Group (taken out by an Owner or the Super admin). */
export interface GroupMemberRemoved extends DomainEvent {
  readonly type: 'GroupMemberRemoved'
  readonly groupId: number
  readonly userId: number
}

export function groupMemberRemoved(
  groupId: number,
  userId: number,
  occurredAt: Date,
): GroupMemberRemoved {
  return { type: 'GroupMemberRemoved', groupId, userId, occurredAt }
}
