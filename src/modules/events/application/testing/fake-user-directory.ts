import { type DirectoryUser, UserDirectory } from '../ports/user-directory.js'

/** The Users the test arranges, standing in for the identity context. */
export class FakeUserDirectory extends UserDirectory {
  private readonly users = new Map<number, DirectoryUser>()

  add(user: DirectoryUser): this {
    this.users.set(user.id, user)
    return this
  }

  async findManyByIds(ids: readonly number[]): Promise<DirectoryUser[]> {
    return ids.flatMap((id) => {
      const user = this.users.get(id)
      return user ? [user] : []
    })
  }
}
