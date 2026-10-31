export const GROUP_ROLES = ['OWNER', 'VIEWER'] as const
export type GroupRole = (typeof GROUP_ROLES)[number]

/** The tie between a User and a Group, with their role there. */
export interface GroupMember {
  groupId: number
  userId: number
  role: GroupRole
}
