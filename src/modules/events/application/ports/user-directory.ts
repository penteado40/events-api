/** A User as events shows them in the list of Participants. */
export interface DirectoryUser {
  id: number
  name: string
  /** E.164, to open WhatsApp. */
  phone: string
}

/** What events asks the identity context about Users. */
export abstract class UserDirectory {
  /** The Users that exist among the ids, in no particular order. */
  abstract findManyByIds(ids: readonly number[]): Promise<DirectoryUser[]>
}
