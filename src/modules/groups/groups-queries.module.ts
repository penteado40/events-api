import { Module } from '@nestjs/common'
import { GroupMembers } from '../identity/index.js'
import { GroupLookup } from './application/group-lookup.js'
import { MembershipLookup } from './application/membership-lookup.js'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { GroupsPersistenceModule } from './groups-persistence.module.js'

/**
 * The read-only queries the groups context offers other contexts: a User's
 * Membership, bound to identity's GroupMembers port, and the GroupLookup that
 * events reads roles from. Static and without controllers; the AppModule hands
 * it to IdentityModule.forRoot, so identity never imports groups (which already
 * depends on identity).
 */
@Module({
  imports: [GroupsPersistenceModule],
  providers: [
    {
      provide: GroupMembers,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository) =>
        new MembershipLookup(groups, members),
      inject: [GroupRepository, GroupMemberRepository],
    },
    {
      provide: GroupLookup,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository) =>
        new GroupLookup(groups, members),
      inject: [GroupRepository, GroupMemberRepository],
    },
  ],
  exports: [GroupMembers, GroupLookup],
})
export class GroupsQueriesModule {}
