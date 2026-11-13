import { Module } from '@nestjs/common'
import { GroupMembers } from '../identity/index.js'
import { MembershipLookup } from './application/membership-lookup.js'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { GroupsPersistenceModule } from './groups-persistence.module.js'

/**
 * The read-only queries the groups context offers other contexts: a User's
 * Membership, bound to identity's GroupMembers port. Static and without
 * controllers; the AppModule hands it to IdentityModule.forRoot, so identity
 * never imports groups (which already depends on identity).
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
  ],
  exports: [GroupMembers],
})
export class GroupsQueriesModule {}
