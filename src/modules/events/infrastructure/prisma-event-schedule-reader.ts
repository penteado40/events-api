import { Injectable } from '@nestjs/common'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import {
  type EventScheduleData,
  EventScheduleReader,
} from '../application/ports/event-schedule-reader.js'
import { snapshotOf } from './prisma-event-item.repository.js'

/** Loads one Event with all its Event items in one query, as plain data (ADR-0019). */
@Injectable()
export class PrismaEventScheduleReader extends EventScheduleReader {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async load(eventId: number): Promise<EventScheduleData | null> {
    const row = await this.unitOfWork.client.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        groupId: true,
        timezone: true,
        // In the order of the production; the assembly sorts again, so this is only for a stable read.
        items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
      },
    })
    if (!row) return null
    return {
      eventId: row.id,
      groupId: row.groupId,
      timezone: row.timezone,
      items: row.items.map(snapshotOf),
    }
  }
}
