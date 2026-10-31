export const GROUP_ROLES = ['OWNER', 'VIEWER'] as const
export type GroupRole = (typeof GROUP_ROLES)[number]

/** A Group the User is a Group member of, and their role there. */
export interface GroupMembership {
  groupId: number
  groupName: string
  role: GroupRole
}

/**
 * Reads the Membership of a User: the Groups they are a Group member of. Until
 * the Groups arrive (PROJ-168, PROJ-172, PROJ-177) nobody has one.
 */
export abstract class Memberships {
  abstract of(userId: number): Promise<GroupMembership[]>
}
