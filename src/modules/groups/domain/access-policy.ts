import type { GroupRole } from './group-member.js'

/** Who acts: the Super admin, or a User with their Membership. */
export interface Actor {
  userId: number
  isSuperAdmin: boolean
  /** The Membership: Group id → role, for every Group the User is a Group member of. */
  membership: ReadonlyMap<number, GroupRole>
}

export type GroupAction =
  | { type: 'createGroup' }
  | { type: 'listAllGroups' }
  | { type: 'viewGroup'; groupId: number }
  | { type: 'renameGroup'; groupId: number }
  /** Give, take, demote or promote an Owner (ADR-0017). */
  | { type: 'manageOwners'; groupId: number }
  /** Add a Viewer to the Group: the Super admin or an Owner of that Group. */
  | { type: 'manageViewers'; groupId: number }
  /** Create, rename and delete the Teams of the Group: the Super admin or an Owner of that Group. */
  | { type: 'manageTeams'; groupId: number }
  /** An Owner leaves the Group or demotes themselves to Viewer, on their own. */
  | { type: 'leaveGroup'; groupId: number }
  | { type: 'demoteSelf'; groupId: number }

/**
 * Decides whether an actor may take an action (docs/arquitetura.md §2). The
 * Super admin may do anything but act as a Group member; a User's access comes
 * only from their Group members.
 */
export const AccessPolicy = {
  can(actor: Actor, action: GroupAction): boolean {
    switch (action.type) {
      case 'createGroup':
      case 'listAllGroups':
      case 'renameGroup':
      case 'manageOwners':
        return actor.isSuperAdmin
      case 'manageViewers':
      case 'manageTeams':
        return actor.isSuperAdmin || actor.membership.get(action.groupId) === 'OWNER'
      case 'viewGroup':
        return actor.isSuperAdmin || actor.membership.has(action.groupId)
      // Only an Owner steps down; the Super admin is never a Group member.
      case 'leaveGroup':
      case 'demoteSelf':
        return actor.membership.get(action.groupId) === 'OWNER'
    }
  },
}
