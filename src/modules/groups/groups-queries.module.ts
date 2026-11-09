import { Module } from '@nestjs/common'
import { MembershipLookup } from './application/membership-lookup.js'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { GroupsPersistenceModule } from './groups-persistence.module.js'

/**
 * The read-only queries the groups context offers other contexts (a User's
 * Membership). Static and without controllers, so identity can import it
 * without importing GroupsModule, which already depends on identity.
 */
@Module({
  imports: [GroupsPersistenceModule],
  providers: [
    {
      provide: MembershipLookup,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository) =>
        new MembershipLookup(groups, members),
      inject: [GroupRepository, GroupMemberRepository],
    },
  ],
  exports: [MembershipLookup],
})
export class GroupsQueriesModule {}
