import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { UnitOfWork } from '../../shared/application/unit-of-work.js'
import { EmailsModule, GroupEmails } from '../emails/index.js'
import { IdentityAccountsModule, UserAccounts } from '../identity/index.js'
import { GroupMailer } from './application/ports/group-mailer.js'
import { GroupUserAccounts } from './application/ports/group-user-accounts.js'
import { AddOwnerUseCase } from './application/use-cases/add-owner.use-case.js'
import { AddViewerUseCase } from './application/use-cases/add-viewer.use-case.js'
import { CreateGroupUseCase } from './application/use-cases/create-group.use-case.js'
import { CreateTeamUseCase } from './application/use-cases/create-team.use-case.js'
import { DeleteTeamUseCase } from './application/use-cases/delete-team.use-case.js'
import { ListTeamsUseCase } from './application/use-cases/list-teams.use-case.js'
import { RenameTeamUseCase } from './application/use-cases/rename-team.use-case.js'
import { DemoteOwnerUseCase } from './application/use-cases/demote-owner.use-case.js'
import { DemoteSelfUseCase } from './application/use-cases/demote-self.use-case.js'
import { GetGroupUseCase } from './application/use-cases/get-group.use-case.js'
import { LeaveGroupUseCase } from './application/use-cases/leave-group.use-case.js'
import { ListGroupsUseCase } from './application/use-cases/list-groups.use-case.js'
import { PromoteToOwnerUseCase } from './application/use-cases/promote-to-owner.use-case.js'
import { RemoveOwnerUseCase } from './application/use-cases/remove-owner.use-case.js'
import { RenameGroupUseCase } from './application/use-cases/rename-group.use-case.js'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRosterRepository } from './domain/group-roster.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { TeamRepository } from './domain/team.repository.js'
import { InProcessGroupMailer } from './infrastructure/in-process-group-mailer.js'
import { InProcessGroupUserAccounts } from './infrastructure/in-process-group-user-accounts.js'
import { PrismaGroupMemberRepository } from './infrastructure/prisma-group-member.repository.js'
import { PrismaGroupRosterRepository } from './infrastructure/prisma-group-roster.repository.js'
import { PrismaGroupRepository } from './infrastructure/prisma-group.repository.js'
import { PrismaTeamRepository } from './infrastructure/prisma-team.repository.js'
import { GroupsController } from './presentation/groups.controller.js'
import { TeamsController } from './presentation/teams.controller.js'

/** Composition root of the groups context: Groups, their Group members and the AccessPolicy. */
@Module({
  imports: [IdentityAccountsModule, EmailsModule],
  controllers: [GroupsController, TeamsController],
  providers: [
    { provide: GroupRepository, useClass: PrismaGroupRepository },
    { provide: GroupMemberRepository, useClass: PrismaGroupMemberRepository },
    { provide: TeamRepository, useClass: PrismaTeamRepository },
    { provide: GroupRosterRepository, useClass: PrismaGroupRosterRepository },
    {
      provide: GroupUserAccounts,
      useFactory: (accounts: UserAccounts) => new InProcessGroupUserAccounts(accounts),
      inject: [UserAccounts],
    },
    {
      provide: GroupMailer,
      useFactory: (emails: GroupEmails) => new InProcessGroupMailer(emails),
      inject: [GroupEmails],
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
        groups: GroupRepository,
        members: GroupMemberRepository,
        accounts: GroupUserAccounts,
        mailer: GroupMailer,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new AddOwnerUseCase(rosters, groups, members, accounts, mailer, unitOfWork, clock),
      inject: [
        GroupRosterRepository,
        GroupRepository,
        GroupMemberRepository,
        GroupUserAccounts,
        GroupMailer,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: AddViewerUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        groups: GroupRepository,
        members: GroupMemberRepository,
        accounts: GroupUserAccounts,
        mailer: GroupMailer,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new AddViewerUseCase(rosters, groups, members, accounts, mailer, unitOfWork, clock),
      inject: [
        GroupRosterRepository,
        GroupRepository,
        GroupMemberRepository,
        GroupUserAccounts,
        GroupMailer,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: RemoveOwnerUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        members: GroupMemberRepository,
        unitOfWork: UnitOfWork,
      ) => new RemoveOwnerUseCase(rosters, members, unitOfWork),
      inject: [GroupRosterRepository, GroupMemberRepository, UnitOfWork],
    },
    {
      provide: DemoteOwnerUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        members: GroupMemberRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new DemoteOwnerUseCase(rosters, members, unitOfWork, clock),
      inject: [GroupRosterRepository, GroupMemberRepository, UnitOfWork, Clock],
    },
    {
      provide: PromoteToOwnerUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        members: GroupMemberRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new PromoteToOwnerUseCase(rosters, members, unitOfWork, clock),
      inject: [GroupRosterRepository, GroupMemberRepository, UnitOfWork, Clock],
    },
    {
      provide: LeaveGroupUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        members: GroupMemberRepository,
        unitOfWork: UnitOfWork,
      ) => new LeaveGroupUseCase(rosters, members, unitOfWork),
      inject: [GroupRosterRepository, GroupMemberRepository, UnitOfWork],
    },
    {
      provide: DemoteSelfUseCase,
      useFactory: (
        rosters: GroupRosterRepository,
        members: GroupMemberRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new DemoteSelfUseCase(rosters, members, unitOfWork, clock),
      inject: [GroupRosterRepository, GroupMemberRepository, UnitOfWork, Clock],
    },
    {
      provide: CreateTeamUseCase,
      useFactory: (
        groups: GroupRepository,
        members: GroupMemberRepository,
        teams: TeamRepository,
        clock: Clock,
      ) => new CreateTeamUseCase(groups, members, teams, clock),
      inject: [GroupRepository, GroupMemberRepository, TeamRepository, Clock],
    },
    {
      provide: RenameTeamUseCase,
      useFactory: (
        groups: GroupRepository,
        members: GroupMemberRepository,
        teams: TeamRepository,
        clock: Clock,
      ) => new RenameTeamUseCase(groups, members, teams, clock),
      inject: [GroupRepository, GroupMemberRepository, TeamRepository, Clock],
    },
    {
      provide: ListTeamsUseCase,
      useFactory: (
        groups: GroupRepository,
        members: GroupMemberRepository,
        teams: TeamRepository,
      ) => new ListTeamsUseCase(groups, members, teams),
      inject: [GroupRepository, GroupMemberRepository, TeamRepository],
    },
    {
      provide: DeleteTeamUseCase,
      useFactory: (
        groups: GroupRepository,
        members: GroupMemberRepository,
        teams: TeamRepository,
      ) => new DeleteTeamUseCase(groups, members, teams),
      inject: [GroupRepository, GroupMemberRepository, TeamRepository],
    },
  ],
})
export class GroupsModule {}
