import { Injectable } from '@nestjs/common'
import { Prisma } from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { createdWith } from '../../../shared/domain/stamp.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { GroupRoster } from '../domain/group-roster.js'
import { GroupRosterRepository } from '../domain/group-roster.repository.js'

@Injectable()
export class PrismaGroupRosterRepository extends GroupRosterRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findByGroup(groupId: number): Promise<GroupRoster | null> {
    const row = await this.prisma.group.findUnique({
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

  // The writes are not serialized yet: the last-Owner rule that needs it comes with PROJ-175.
  async save(roster: GroupRoster): Promise<void> {
    const { added, firstOwner } = roster.changes()
    const writes: Prisma.PrismaPromise<unknown>[] = added.map(({ member, stamp }) =>
      this.prisma.groupMember.create({ data: { ...member, ...createdWith(stamp) } }),
    )
    if (firstOwner) {
      writes.push(
        this.prisma.group.update({
          where: { id: roster.groupId },
          data: { hasHadOwner: true, updatedAt: firstOwner.at, updatedById: firstOwner.by },
        }),
      )
    }
    try {
      await this.prisma.$transaction(writes)
    } catch (error) {
      // The roster checks first; this covers the same User added twice at once.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('ALREADY_A_GROUP_MEMBER')
      }
      throw error
    }
  }
}
