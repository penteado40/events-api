import { Injectable } from '@nestjs/common'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import {
  type EventScheduleData,
  EventScheduleReader,
} from '../application/ports/event-schedule-reader.js'
import { snapshotOf, WITH_AUDIENCE } from './prisma-event-item.repository.js'
import { cancelledFromOf } from './prisma-event.repository.js'
import { FIELD_ORDER, fieldSnapshotOf } from './prisma-field.repository.js'

/** Loads one Event with all its Event items, their Audiences and Fields, and its Participants in one query, as plain data (ADR-0019). */
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
        state: true,
        cancelledFrom: true,
        participants: { select: { userId: true }, orderBy: { id: 'asc' } },
        // In the order of the production; the assembly sorts again, so this is only for a stable read.
        items: {
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          include: { ...WITH_AUDIENCE, fields: { orderBy: [...FIELD_ORDER] } },
        },
      },
    })
    if (!row) return null
    return {
      eventId: row.id,
      groupId: row.groupId,
      timezone: row.timezone,
      state: row.state,
      cancelledFrom: cancelledFromOf(row.cancelledFrom),
      participants: row.participants.map((p) => p.userId),
      items: row.items.map(snapshotOf),
      fields: row.items.flatMap((item) => item.fields.map(fieldSnapshotOf)),
    }
  }
}
