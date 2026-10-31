import { type GroupMembership, Memberships } from '../application/ports/memberships.js'

/**
 * No Groups exist yet, so nobody has a Membership. PROJ-168, PROJ-172 and
 * PROJ-177 replace it with a read of the Group members.
 */
export class NoGroupsMemberships extends Memberships {
  async of(): Promise<GroupMembership[]> {
    return []
  }
}
