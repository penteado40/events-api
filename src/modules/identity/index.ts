// Public API of the identity context. Other modules import only from here.
export { IdentityModule, type IdentityModuleOptions } from './identity.module.js'
export type { Role, User } from './domain/user.entity.js'
export { UserLookup, type UserSummary } from './application/user-lookup.js'
