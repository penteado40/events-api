import type { GroupMemberRole, GroupRole } from '../../domain/event-access-policy.js'

/** What events asks the groups context about a Group and its Group members. */
export abstract class GroupDirectory {
  abstract exists(groupId: number): Promise<boolean>
  /** The User's role in the Group; null when they are not a Group member of it, or it does not exist. */
  abstract roleIn(groupId: number, userId: number): Promise<GroupRole | null>
  /**
   * Every Group member of the Group (Owners and Viewers), with their role, in
   * the order they joined, holding its roster against writes until the running
   * UnitOfWork ends (ADR-0014): a Viewer added or removed meanwhile waits, and
   * so does another holder of it, in arrival order. Only inside a UnitOfWork.
   */
  abstract lockMembers(groupId: number): Promise<GroupMemberRole[]>
}
