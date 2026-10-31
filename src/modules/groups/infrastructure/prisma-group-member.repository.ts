import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import type { GroupMember } from '../domain/group-member.js'
import { GroupMemberRepository } from '../domain/group-member.repository.js'

@Injectable()
export class PrismaGroupMemberRepository extends GroupMemberRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findByUser(userId: number): Promise<GroupMember[]> {
    return this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true, userId: true, role: true },
    })
  }
}
