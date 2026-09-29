import { type DirectoryUser, UserDirectory } from '../ports/user-directory.js'

export class FakeUserDirectory extends UserDirectory {
  private readonly users = new Map<number, DirectoryUser>()

  async findById(id: number): Promise<DirectoryUser | null> {
    return this.users.get(id) ?? null
  }

  add(user: DirectoryUser): void {
    this.users.set(user.id, user)
  }
}
