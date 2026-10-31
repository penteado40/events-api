import type { GroupRole } from './group-member.js'

/** Who acts: the Super admin, or a User with the role they hold in each of their Groups. */
export interface Actor {
  userId: number
  isSuperAdmin: boolean
  /** Group id → role, for every Group the User is a Group member of. */
  groupRoles: ReadonlyMap<number, GroupRole>
}

export type GroupAction =
  | { type: 'createGroup' }
  | { type: 'listAllGroups' }
  | { type: 'viewGroup'; groupId: number }
  | { type: 'renameGroup'; groupId: number }

/**
 * Decides whether an actor may take an action (docs/arquitetura.md §2). The
 * Super admin may do anything; a User's access comes only from their Group
 * members.
 */
export const AccessPolicy = {
  can(actor: Actor, action: GroupAction): boolean {
    if (actor.isSuperAdmin) return true
    switch (action.type) {
      case 'createGroup':
      case 'listAllGroups':
      case 'renameGroup':
        return false
      case 'viewGroup':
        return actor.groupRoles.has(action.groupId)
    }
  },
}
