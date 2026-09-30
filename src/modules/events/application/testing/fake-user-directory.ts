import { type DirectoryUser, UserDirectory } from '../ports/user-directory.js'

export class FakeUserDirectory extends UserDirectory {
  private readonly users = new Map<number, DirectoryUser>()

  async findById(id: number): Promise<DirectoryUser | null> {
    return this.users.get(id) ?? null
  }

  async findManyByIds(ids: number[]): Promise<DirectoryUser[]> {
    return ids.flatMap((id) => this.users.get(id) ?? [])
  }

  /** An active, non-admin User unless the overrides say otherwise. */
  add(user: Pick<DirectoryUser, 'id'> & Partial<DirectoryUser>): DirectoryUser {
    const stored: DirectoryUser = {
      name: `User ${user.id}`,
      email: `user${user.id}@example.com`,
      isSuperAdmin: false,
      isPending: false,
      ...user,
    }
    this.users.set(stored.id, stored)
    return stored
  }

  all(): DirectoryUser[] {
    return [...this.users.values()]
  }
}
