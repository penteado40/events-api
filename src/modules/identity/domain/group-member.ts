export const GROUP_ROLES = ['OWNER', 'VIEWER'] as const
export type GroupRole = (typeof GROUP_ROLES)[number]

/** A Group member seen from the User: the Group they belong to and their role there. */
export interface GroupMember {
  groupId: number
  groupName: string
  role: GroupRole
}
