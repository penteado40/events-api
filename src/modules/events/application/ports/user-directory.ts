/** The few facts about a User that the events context needs, owned by identity. */
export interface DirectoryUser {
  id: number
  name: string
  email: string
  isSuperAdmin: boolean
  isPending: boolean
}

export abstract class UserDirectory {
  abstract findById(id: number): Promise<DirectoryUser | null>
  /** The Users that exist among the ids, in no particular order. */
  abstract findManyByIds(ids: number[]): Promise<DirectoryUser[]>
}
