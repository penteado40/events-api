import type { UserRepository } from '../domain/user.repository.js'

/** What other contexts may know about a User. */
export interface UserSummary {
  id: number
  isSuperAdmin: boolean
}

/** Read-only query that the identity context exports to other contexts. */
export class UserLookup {
  constructor(private readonly users: UserRepository) {}

  async findById(id: number): Promise<UserSummary | null> {
    const user = await this.users.findById(id)
    return user ? { id: user.id, isSuperAdmin: user.isSuperAdmin } : null
  }
}
