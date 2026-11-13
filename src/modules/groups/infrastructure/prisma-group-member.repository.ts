import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../../generated/prisma/client.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import type { GroupMember } from '../domain/group-member.js'
import { GroupMemberRepository } from '../domain/group-member.repository.js'

@Injectable()
export class PrismaGroupMemberRepository extends GroupMemberRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async findByUser(userId: number): Promise<GroupMember[]> {
    return this.unitOfWork.client.groupMember.findMany({
      where: { userId },
      select: { groupId: true, userId: true, role: true },
    })
  }

  async findByGroup(groupId: number): Promise<GroupMember[]> {
    return ofGroup(this.unitOfWork.client, groupId)
  }

  // The same FOR UPDATE a roster write takes (ADR-0014): a FOR SHARE would let
  // overlapping readers jump the queue and starve a roster write waiting for the row.
  async lockByGroup(groupId: number): Promise<GroupMember[]> {
    const tx = this.unitOfWork.transaction()
    await tx.$queryRaw`SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`
    return ofGroup(tx, groupId)
  }
}

function ofGroup(db: Prisma.TransactionClient, groupId: number): Promise<GroupMember[]> {
  return db.groupMember.findMany({
    where: { groupId },
    select: { groupId: true, userId: true, role: true },
    orderBy: { id: 'asc' },
  })
}
