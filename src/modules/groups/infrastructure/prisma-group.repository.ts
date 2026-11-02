import { Injectable } from '@nestjs/common'
import type { Group as PrismaGroup } from '../../../generated/prisma/client.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { Group, type NewGroupProps } from '../domain/group.entity.js'
import { GroupRepository } from '../domain/group.repository.js'

const BY_NAME = [{ name: 'asc' as const }, { id: 'asc' as const }]

@Injectable()
export class PrismaGroupRepository extends GroupRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findById(id: number): Promise<Group | null> {
    const row = await this.prisma.group.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findAll(): Promise<Group[]> {
    const rows = await this.prisma.group.findMany({ orderBy: BY_NAME })
    return rows.map(toDomain)
  }

  async findManyByIds(ids: number[]): Promise<Group[]> {
    const rows = await this.prisma.group.findMany({
      where: { id: { in: ids } },
      orderBy: BY_NAME,
    })
    return rows.map(toDomain)
  }

  async create(props: NewGroupProps, stamp: Stamp): Promise<Group> {
    const row = await this.prisma.group.create({
      data: { name: props.name.value, ...createdWith(stamp) },
    })
    return toDomain(row)
  }

  async save(group: Group): Promise<void> {
    await this.prisma.group.update({
      where: { id: group.id },
      data: { name: group.name, updatedAt: group.updatedAt, updatedById: group.updatedById },
    })
  }
}

function toDomain(row: PrismaGroup): Group {
  return Group.restore({
    id: row.id,
    name: row.name,
    hasHadOwner: row.hasHadOwner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
