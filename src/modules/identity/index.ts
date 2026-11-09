// Public API of the identity context. Other modules import only from here.
export { IdentityQueriesModule } from './identity-queries.module.js'
export { IdentityAccountsModule } from './identity-accounts.module.js'
// Order matters: groups and identity import each other's index, so the leaf
// modules come before IdentityModule (see groups/index.ts).
export type { Role, User } from './domain/user.entity.js'
export { UserLookup, type UserSummary } from './application/user-lookup.js'
export { UserAccounts, type EnsuredUser } from './application/user-accounts.js'
export type { IssuedActivationLink } from './application/activation-links.js'
export { IdentityModule } from './identity.module.js'
