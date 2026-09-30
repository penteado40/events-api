import { Injectable } from '@nestjs/common'
import { type ApiToken as PrismaApiToken, Prisma } from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { ApiToken, type NewApiTokenProps } from '../domain/api-token.entity.js'
import { ApiTokenRepository } from '../domain/api-token.repository.js'
import { SCOPES, type Scope } from '../domain/scope.js'

@Injectable()
export class PrismaApiTokenRepository extends ApiTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async create(props: NewApiTokenProps, stamp: Stamp): Promise<ApiToken> {
    const row = await this.prisma.apiToken.create({ data: { ...props, ...createdWith(stamp) } })
    return toDomain(row)
  }

  async findInEvent(eventId: number, apiTokenId: number): Promise<ApiToken | null> {
    const row = await this.prisma.apiToken.findFirst({ where: { id: apiTokenId, eventId } })
    return row ? toDomain(row) : null
  }

  async findByHash(tokenHash: string): Promise<ApiToken | null> {
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash } })
    return row ? toDomain(row) : null
  }

  async listByEvent(eventId: number): Promise<ApiToken[]> {
    const rows = await this.prisma.apiToken.findMany({ where: { eventId }, orderBy: { id: 'asc' } })
    return rows.map(toDomain)
  }

  async save(apiToken: ApiToken): Promise<void> {
    try {
      await this.prisma.apiToken.update({
        where: { id: apiToken.id },
        data: {
          name: apiToken.name,
          scopes: apiToken.scopes,
          isActive: apiToken.isActive,
          updatedAt: apiToken.updatedAt,
          updatedById: apiToken.updatedById,
        },
      })
    } catch (error) {
      // Deleted by someone else between the read and the write.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError('API_TOKEN_NOT_FOUND')
      }
      throw error
    }
  }

  async delete(apiToken: ApiToken): Promise<void> {
    await this.prisma.apiToken.deleteMany({ where: { id: apiToken.id } })
  }

  async saveLastUse(apiToken: ApiToken): Promise<void> {
    // updatedAt is given back as it was, or @updatedAt would stamp the use as an edit.
    await this.prisma.apiToken.updateMany({
      where: { id: apiToken.id },
      data: { lastUsedAt: apiToken.lastUsedAt, updatedAt: apiToken.updatedAt },
    })
  }
}

function toDomain(row: PrismaApiToken): ApiToken {
  return ApiToken.restore({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    tokenHash: row.tokenHash,
    // A Scope the code no longer knows grants nothing.
    scopes: (row.scopes ?? []).filter((s): s is Scope => (SCOPES as readonly string[]).includes(s)),
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
