import type { UserLookup } from '../../identity/index.js'
import { type GroupMemberUser, GroupUsers } from '../application/ports/group-users.js'

/** The GroupUsers port over the read-only queries identity offers other contexts. */
export class InProcessGroupUsers extends GroupUsers {
  constructor(private readonly lookup: UserLookup) {
    super()
  }

  findManyByIds(ids: number[]): Promise<GroupMemberUser[]> {
    return this.lookup.findManyByIds(ids)
  }
}
