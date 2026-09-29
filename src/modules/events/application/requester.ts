/** The authenticated User asking for something, as the events context sees them. */
export interface Requester {
  id: number
  isSuperAdmin: boolean
}
