/** The logged-in User, as the events context needs them (identity's User fits). */
export interface ActingUser {
  id: number
  isSuperAdmin: boolean
}
