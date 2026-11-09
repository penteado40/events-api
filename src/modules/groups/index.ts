// Public API of the groups context. Other modules import only from here.
// Order matters: identity and groups import each other's index (identity reads
// the Membership, groups reads Users), so the leaf modules come first and each
// is evaluated before the cycle closes.
export { GroupsQueriesModule } from './groups-queries.module.js'
export { MembershipLookup, type UserMembership } from './application/membership-lookup.js'
export { GroupsModule } from './groups.module.js'
