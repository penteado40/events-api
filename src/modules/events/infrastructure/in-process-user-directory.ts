import type { UserLookup } from '../../identity/index.js'
import { type DirectoryUser, UserDirectory } from '../application/ports/user-directory.js'

/** The UserDirectory port over the read-only queries identity offers other contexts. */
export class InProcessUserDirectory extends UserDirectory {
  constructor(private readonly lookup: UserLookup) {
    super()
  }

  async findManyByIds(ids: readonly number[]): Promise<DirectoryUser[]> {
    const users = await this.lookup.findManyByIds([...ids])
    return users.map(({ id, name, phone }) => ({ id, name, phone }))
  }
}
