/** A User as the Group's member list shows them: name, email and phone, to reach them. */
export interface GroupMemberUser {
  id: number
  name: string
  email: string
  phone: string
  isPending: boolean
}

/** Read-only view of the Users behind the Group members: identity's UserLookup, seen from groups. */
export abstract class GroupUsers {
  /** The Users that exist among the ids, in no particular order. */
  abstract findManyByIds(ids: number[]): Promise<GroupMemberUser[]>
}
