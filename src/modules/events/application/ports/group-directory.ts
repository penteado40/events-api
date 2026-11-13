import type { GroupRole } from '../../domain/event-access-policy.js'

/** What events asks the groups context about a Group and its Group members. */
export abstract class GroupDirectory {
  abstract exists(groupId: number): Promise<boolean>
  /** The User's role in the Group; null when they are not a Group member of it, or it does not exist. */
  abstract roleIn(groupId: number, userId: number): Promise<GroupRole | null>
}
