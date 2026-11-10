import { Module } from '@nestjs/common'
import { GroupMemberRepository } from './domain/group-member.repository.js'
import { GroupRepository } from './domain/group.repository.js'
import { PrismaGroupMemberRepository } from './infrastructure/prisma-group-member.repository.js'
import { PrismaGroupRepository } from './infrastructure/prisma-group.repository.js'

/** Internal to groups (not in index.ts): binds the Group and Group member repositories once. */
@Module({
  providers: [
    { provide: GroupRepository, useClass: PrismaGroupRepository },
    { provide: GroupMemberRepository, useClass: PrismaGroupMemberRepository },
  ],
  exports: [GroupRepository, GroupMemberRepository],
})
export class GroupsPersistenceModule {}
