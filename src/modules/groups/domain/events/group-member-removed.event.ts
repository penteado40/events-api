import type { DomainEvent } from '../../../../shared/domain/domain-event.js'

/** A Viewer was taken out of the Group by an Owner or the Super admin (Owner removals do not record it yet). */
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
