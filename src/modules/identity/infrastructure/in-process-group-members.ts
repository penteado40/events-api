import { Injectable } from '@nestjs/common'
import { MembershipLookup } from '../../groups/index.js'
import type { GroupMember } from '../domain/group-member.js'
import { GroupMembers } from '../application/ports/group-members.js'

/** The Groups of a User, read from the groups context in this process. */
@Injectable()
export class InProcessGroupMembers extends GroupMembers {
  constructor(private readonly membership: MembershipLookup) {
    super()
  }

  ofUser(userId: number): Promise<GroupMember[]> {
    return this.membership.ofUser(userId)
  }
}
