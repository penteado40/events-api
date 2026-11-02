import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { IdentityAccountsModule, UserAccounts } from '../identity/index.js'
import { GroupUserAccounts } from './application/ports/group-user-accounts.js'
import { AddOwnerUseCase } from './application/use-cases/add-owner.use-case.js'
import { CreateGroupUseCase } from './application/use-cases/create-group.use-case.js'
import { GetGroupUseCase } from './application/use-cases/get-group.use-case.js'
import { ListGroupsUseCase } from './application/use-cases/list-groups.use-case.js'
import { RenameGroupUseCase } from './application/use-cases/rename-group.use-case.js'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRosterRepository } from './domain/group-roster.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { InProcessGroupUserAccounts } from './infrastructure/in-process-group-user-accounts.js'
import { PrismaGroupMemberRepository } from './infrastructure/prisma-group-member.repository.js'
import { PrismaGroupRosterRepository } from './infrastructure/prisma-group-roster.repository.js'
import { PrismaGroupRepository } from './infrastructure/prisma-group.repository.js'
import { GroupsController } from './presentation/groups.controller.js'

/** Composition root of the groups context: Groups, their Group members and the AccessPolicy. */
@Module({
  imports: [IdentityAccountsModule],
  controllers: [GroupsController],
  providers: [
    { provide: GroupRepository, useClass: PrismaGroupRepository },
    { provide: GroupMemberRepository, useClass: PrismaGroupMemberRepository },
    { provide: GroupRosterRepository, useClass: PrismaGroupRosterRepository },
    {
      provide: GroupUserAccounts,
      useFactory: (accounts: UserAccounts) => new InProcessGroupUserAccounts(accounts),
      inject: [UserAccounts],
    },
    {
      provide: CreateGroupUseCase,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository, clock: Clock) =>
        new CreateGroupUseCase(groups, members, clock),
      inject: [GroupRepository, GroupMemberRepository, Clock],
    },
    {
      provide: ListGroupsUseCase,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository) =>
        new ListGroupsUseCase(groups, members),
      inject: [GroupRepository, GroupMemberRepository],
    },
    {
      provide: RenameGroupUseCase,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository, clock: Clock) =>
        new RenameGroupUseCase(groups, members, clock),
      inject: [GroupRepository, GroupMemberRepository, Clock],
    },
    {
      provide: GetGroupUseCase,
      useFactory: (groups: GroupRepository, members: GroupMemberRepository) =>
        new GetGroupUseCase(groups, members),
      inject: [GroupRepository, GroupMemberRepository],
    },
    {
      provide: AddOwnerUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        members: GroupMemberRepository,
        accounts: GroupUserAccounts,
        clock: Clock,
      ) => new AddOwnerUseCase(rosters, members, accounts, clock),
      inject: [GroupRosterRepository, GroupMemberRepository, GroupUserAccounts, Clock],
    },
  ],
})
export class GroupsModule {}
