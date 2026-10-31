import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { CreateGroupUseCase } from './application/use-cases/create-group.use-case.js'
import { ListGroupsUseCase } from './application/use-cases/list-groups.use-case.js'
import { RenameGroupUseCase } from './application/use-cases/rename-group.use-case.js'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { PrismaGroupMemberRepository } from './infrastructure/prisma-group-member.repository.js'
import { PrismaGroupRepository } from './infrastructure/prisma-group.repository.js'
import { GroupsController } from './presentation/groups.controller.js'

/** Composition root of the groups context: Groups, their Group members and the AccessPolicy. */
@Module({
  controllers: [GroupsController],
  providers: [
    { provide: GroupRepository, useClass: PrismaGroupRepository },
    { provide: GroupMemberRepository, useClass: PrismaGroupMemberRepository },
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
  ],
})
export class GroupsModule {}
