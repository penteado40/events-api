import type { User } from '../domain/user.entity.js'
import type { UserRepository } from '../domain/user.repository.js'

/** What other contexts may know about a User. */
export interface UserSummary {
  id: number
  name: string
  email: string
  isSuperAdmin: boolean
  isPending: boolean
}

export function toUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value,
    isSuperAdmin: user.isSuperAdmin,
    isPending: user.isPending,
  }
}

/** Read-only query that the identity context exports to other contexts. */
export class UserLookup {
  constructor(private readonly users: UserRepository) {}

  async findById(id: number): Promise<UserSummary | null> {
    const user = await this.users.findById(id)
    return user ? toUserSummary(user) : null
  }

  /** The Users that exist among the ids, in no particular order. */
  async findManyByIds(ids: number[]): Promise<UserSummary[]> {
    return (await this.users.findManyByIds(ids)).map(toUserSummary)
  }
}
