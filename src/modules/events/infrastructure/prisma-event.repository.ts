import { Injectable } from '@nestjs/common'
import type { Event as PrismaEvent } from '../../../generated/prisma/client.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import { EventPeriod } from '../domain/event-period.vo.js'
import {
  type CancellableEventState,
  Event,
  type EventState,
  type NewEventProps,
} from '../domain/event.entity.js'
import { EventRepository } from '../domain/event.repository.js'

const BY_START_DATE = [{ startDate: 'asc' as const }, { id: 'asc' as const }]

@Injectable()
export class PrismaEventRepository extends EventRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async findById(id: number): Promise<Event | null> {
    const row = await this.unitOfWork.client.event.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  // FOR UPDATE holds the Event's row until the transaction ends.
  async lockById(id: number): Promise<Event | null> {
    const tx = this.unitOfWork.transaction()
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM events WHERE id = ${id} FOR UPDATE`
    if (locked.length === 0) return null
    const row = await tx.event.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByGroup(groupId: number): Promise<Event[]> {
    const rows = await this.unitOfWork.client.event.findMany({
      where: { groupId },
      orderBy: BY_START_DATE,
    })
    return rows.map(toDomain)
  }

  async create(props: NewEventProps, stamp: Stamp): Promise<Event> {
    const row = await this.unitOfWork.client.event.create({
      data: {
        groupId: props.groupId,
        name: props.name.value,
        place: props.place.value,
        ...periodColumns(props.period),
        ...createdWith(stamp),
      },
    })
    return toDomain(row)
  }

  async save(event: Event): Promise<void> {
    await this.unitOfWork.client.event.update({
      where: { id: event.id },
      data: {
        name: event.name,
        place: event.place,
        ...periodColumns(event.period),
        state: event.state,
        cancelledFrom: event.cancelledFrom,
        updatedAt: event.updatedAt,
        updatedById: event.updatedById,
      },
    })
  }
}

/**
 * A DATE column comes and goes as a JS Date at UTC midnight: only the
 * calendar day is read or written, so no zone ever shifts it.
 */
function periodColumns(period: EventPeriod) {
  const { startDate, endDate, timezone } = period.toValues()
  return {
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
    timezone,
  }
}

function calendarDay(column: Date): string {
  return column.toISOString().slice(0, 10)
}

/** The table's check keeps CANCELLED out of the column; a row that breaks it is a bug. */
function cancelledFromOf(column: EventState | null): CancellableEventState | null {
  if (column === 'CANCELLED') throw new Error('An Event cannot be cancelled from CANCELLED')
  return column
}

function toDomain(row: PrismaEvent): Event {
  return Event.restore({
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    place: row.place,
    period: EventPeriod.create({
      startDate: calendarDay(row.startDate),
      endDate: calendarDay(row.endDate),
      timezone: row.timezone,
    }),
    state: row.state,
    cancelledFrom: cancelledFromOf(row.cancelledFrom),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
