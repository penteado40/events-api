// Public API of the identity context. Other modules import only from here.
export { IdentityModule } from './identity.module.js'
export { IdentityQueriesModule } from './identity-queries.module.js'
export { IdentityAccountsModule } from './identity-accounts.module.js'
export type { Role, User } from './domain/user.entity.js'
export { UserLookup, type UserSummary } from './application/user-lookup.js'
export { UserAccounts, type EnsuredUser } from './application/user-accounts.js'
export type { IssuedActivationLink } from './application/activation-links.js'
