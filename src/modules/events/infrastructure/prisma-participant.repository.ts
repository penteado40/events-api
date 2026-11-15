import { Injectable } from '@nestjs/common'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import { ParticipantRepository } from '../domain/participant.repository.js'

@Injectable()
export class PrismaParticipantRepository extends ParticipantRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async create(eventId: number, userIds: readonly number[], stamp: Stamp): Promise<void> {
    if (userIds.length === 0) return
    // createMany keeps the order of the rows, so the ids follow the order given.
    await this.unitOfWork.client.participant.createMany({
      data: userIds.map((userId) => ({ eventId, userId, ...createdWith(stamp) })),
    })
  }

  async findByEvent(eventId: number): Promise<number[]> {
    const rows = await this.unitOfWork.client.participant.findMany({
      where: { eventId },
      select: { userId: true },
      orderBy: { id: 'asc' },
    })
    return rows.map((r) => r.userId)
  }

  async isParticipant(eventId: number, userId: number): Promise<boolean> {
    const row = await this.unitOfWork.client.participant.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    })
    return row !== null
  }

  async findByUser(userId: number): Promise<{ groupId: number; eventId: number }[]> {
    const rows = await this.unitOfWork.client.participant.findMany({
      where: { userId },
      select: { eventId: true, event: { select: { groupId: true } } },
      orderBy: { eventId: 'asc' },
    })
    return rows.map((r) => ({ groupId: r.event.groupId, eventId: r.eventId }))
  }
}
