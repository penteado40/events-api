/** The few facts about a User that the events context needs, owned by identity. */
export interface DirectoryUser {
  id: number
  isSuperAdmin: boolean
}

export abstract class UserDirectory {
  abstract findById(id: number): Promise<DirectoryUser | null>
}
