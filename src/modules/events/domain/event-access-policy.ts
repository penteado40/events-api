/** The role of a Group member, as the groups context reports it through the GroupDirectory. */
export type GroupRole = 'OWNER' | 'VIEWER'

/** Who acts on the Events of one Group: the Super admin, or a User with their role in that Group (null if none). */
export interface EventActor {
  isSuperAdmin: boolean
  role: GroupRole | null
}

export type EventAction =
  /** See the Events of the Group (where and when, even in Draft): the Super admin or any Group member. */
  | 'viewEvents'
  /** Create and edit the Events of the Group: the Super admin or an Owner. */
  | 'manageEvents'

/** Decides whether an actor may take an action on the Events of a Group (docs/arquitetura.md §2). */
export const EventAccessPolicy = {
  can(actor: EventActor, action: EventAction): boolean {
    switch (action) {
      case 'viewEvents':
        return actor.isSuperAdmin || actor.role !== null
      case 'manageEvents':
        return actor.isSuperAdmin || actor.role === 'OWNER'
    }
  },
}
