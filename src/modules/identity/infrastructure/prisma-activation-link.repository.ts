import { Injectable } from '@nestjs/common'
import type { ActivationLink as PrismaActivationLink } from '../../../generated/prisma/client.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { ActivationLink, type NewActivationLinkProps } from '../domain/activation-link.entity.js'
import {
  ActivationLinkRepository,
  type ActivationOutcome,
} from '../domain/activation-link.repository.js'
import type { User } from '../domain/user.entity.js'

@Injectable()
export class PrismaActivationLinkRepository extends ActivationLinkRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async replaceForUser(props: NewActivationLinkProps): Promise<ActivationLink> {
    const [, row] = await this.prisma.$transaction([
      this.prisma.activationLink.deleteMany({ where: { userId: props.userId } }),
      this.prisma.activationLink.create({ data: props }),
    ])
    return toDomain(row)
  }

  async findByTokenHash(tokenHash: string): Promise<ActivationLink | null> {
    const row = await this.prisma.activationLink.findUnique({ where: { tokenHash } })
    return row ? toDomain(row) : null
  }

  /** Touches two aggregates on purpose: see the port. */
  async completeActivation(link: ActivationLink, user: User, at: Date): Promise<ActivationOutcome> {
    return this.prisma.$transaction(async (tx) => {
      // The row lock taken by this conditional update makes a concurrent
      // activation wait, then match nothing.
      const { count } = await tx.activationLink.updateMany({
        where: { id: link.id, usedAt: null },
        data: { usedAt: at },
      })
      if (count === 0) {
        const stillThere = await tx.activationLink.count({ where: { id: link.id } })
        return stillThere ? 'used' : 'replaced'
      }
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: user.passwordHash, passwordChangedAt: user.passwordChangedAt },
      })
      return 'activated'
    })
  }
}

function toDomain(row: PrismaActivationLink): ActivationLink {
  return ActivationLink.restore({
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  })
}
