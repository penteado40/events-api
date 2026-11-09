import { Injectable } from '@nestjs/common'
import type { Team as PrismaTeam } from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { isUniqueViolation } from '../../../shared/infrastructure/prisma-errors.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { type NewTeamProps, Team } from '../domain/team.entity.js'
import { TeamRepository } from '../domain/team.repository.js'

const BY_NAME = [{ name: 'asc' as const }, { id: 'asc' as const }]

@Injectable()
export class PrismaTeamRepository extends TeamRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findInGroup(groupId: number, id: number): Promise<Team | null> {
    const row = await this.prisma.team.findFirst({ where: { id, groupId } })
    return row ? toDomain(row) : null
  }

  async findByGroup(groupId: number): Promise<Team[]> {
    const rows = await this.prisma.team.findMany({ where: { groupId }, orderBy: BY_NAME })
    return rows.map(toDomain)
  }

  async create(props: NewTeamProps, stamp: Stamp): Promise<Team> {
    try {
      const row = await this.prisma.team.create({
        data: { groupId: props.groupId, name: props.name.value, ...createdWith(stamp) },
      })
      return toDomain(row)
    } catch (error) {
      // The only unique index a new Team can collide on is (groupId, name).
      if (isUniqueViolation(error)) throw new AppError('TEAM_NAME_TAKEN')
      throw error
    }
  }

  async save(team: Team): Promise<void> {
    try {
      await this.prisma.team.update({
        where: { id: team.id },
        data: { name: team.name, updatedAt: team.updatedAt, updatedById: team.updatedById },
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('TEAM_NAME_TAKEN')
      throw error
    }
  }

  async delete(id: number): Promise<void> {
    // deleteMany: a concurrent delete of the same Team is not an error.
    await this.prisma.team.deleteMany({ where: { id } })
  }
}

function toDomain(row: PrismaTeam): Team {
  return Team.restore({
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
