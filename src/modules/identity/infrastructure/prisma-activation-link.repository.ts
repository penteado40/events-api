import { Injectable } from '@nestjs/common'
import type { ActivationLink as PrismaActivationLink } from '../../../generated/prisma/client.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { ActivationLink, type NewActivationLinkProps } from '../domain/activation-link.entity.js'
import { ActivationLinkRepository } from '../domain/activation-link.repository.js'

@Injectable()
export class PrismaActivationLinkRepository extends ActivationLinkRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async replaceForUser(props: NewActivationLinkProps, stamp: Stamp): Promise<ActivationLink> {
    const [, row] = await this.prisma.$transaction([
      this.prisma.activationLink.deleteMany({ where: { userId: props.userId } }),
      this.prisma.activationLink.create({ data: { ...props, ...createdWith(stamp) } }),
    ])
    return toDomain(row)
  }

  async findForUser(userId: number): Promise<ActivationLink | null> {
    const row = await this.prisma.activationLink.findFirst({ where: { userId } })
    return row ? toDomain(row) : null
  }

  async deleteForUser(userId: number): Promise<void> {
    await this.prisma.activationLink.deleteMany({ where: { userId } })
  }
}

function toDomain(row: PrismaActivationLink): ActivationLink {
  return ActivationLink.restore({
    id: row.id,
    userId: row.userId,
    invitationId: row.invitationId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
