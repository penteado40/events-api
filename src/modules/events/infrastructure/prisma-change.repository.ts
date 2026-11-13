import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../../generated/prisma/client.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import type { NewChange } from '../domain/change.js'
import { ChangeRepository } from '../domain/change.repository.js'

@Injectable()
export class PrismaChangeRepository extends ChangeRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async create(eventId: number, changes: readonly NewChange[], stamp: Stamp): Promise<void> {
    if (changes.length === 0) return
    await this.unitOfWork.client.change.createMany({
      data: changes.map((change) => ({
        eventId,
        attribute: change.attribute,
        before: change.before as Prisma.InputJsonValue,
        after: change.after as Prisma.InputJsonValue,
        productionOnly: change.productionOnly,
        reachBefore: change.reachBefore,
        reachAfter: change.reachAfter,
        ...createdWith(stamp),
      })),
    })
  }
}
