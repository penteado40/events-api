import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { createdWith } from '../../../shared/domain/stamp.js'
import { isUniqueViolation } from '../../../shared/infrastructure/prisma-errors.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import { GroupRoster } from '../domain/group-roster.js'
import { GroupRosterRepository } from '../domain/group-roster.repository.js'

@Injectable()
export class PrismaGroupRosterRepository extends GroupRosterRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async findByGroup(groupId: number): Promise<GroupRoster | null> {
    return read(this.unitOfWork.client, groupId)
  }

  // The Group's row is the lock of its roster (ADR-0014): FOR UPDATE holds it until the transaction ends.
  async lockByGroup(groupId: number): Promise<GroupRoster | null> {
    const tx = this.unitOfWork.transaction()
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`
    return locked.length > 0 ? read(tx, groupId) : null
  }

  async save(roster: GroupRoster): Promise<void> {
    const { added, roleChanges, removed, firstOwner } = roster.changes()
    const { groupId } = roster
    try {
      await this.unitOfWork.run(async () => {
        const tx = this.unitOfWork.client
        for (const { member, stamp } of added) {
          await tx.groupMember.create({ data: { ...member, ...createdWith(stamp) } })
        }
        for (const { member, stamp } of roleChanges) {
          await tx.groupMember.update({
            where: { groupId_userId: { groupId, userId: member.userId } },
            data: { role: member.role, updatedAt: stamp.at, updatedById: stamp.by },
          })
        }
        if (removed.length > 0) {
          await tx.groupMember.deleteMany({ where: { groupId, userId: { in: removed } } })
        }
        if (firstOwner) {
          await tx.group.update({
            where: { id: groupId },
            data: { hasHadOwner: true, updatedAt: firstOwner.at, updatedById: firstOwner.by },
          })
        }
      })
    } catch (error) {
      // The roster checks first; this covers the same User added twice at once.
      if (isUniqueViolation(error)) throw new AppError('ALREADY_A_GROUP_MEMBER')
      throw error
    }
  }
}

async function read(db: Prisma.TransactionClient, groupId: number): Promise<GroupRoster | null> {
  const row = await db.group.findUnique({
    where: { id: groupId },
    select: {
      hasHadOwner: true,
      members: { select: { groupId: true, userId: true, role: true }, orderBy: { id: 'asc' } },
    },
  })
  return row
    ? GroupRoster.restore({ groupId, hasHadOwner: row.hasHadOwner, members: row.members })
    : null
}
