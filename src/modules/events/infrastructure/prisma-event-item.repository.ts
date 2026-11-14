import { Injectable } from '@nestjs/common'
import type { EventItem as PrismaEventItem } from '../../../generated/prisma/client.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import { EventItemPlace } from '../domain/event-item-place.vo.js'
import { EventItemStart } from '../domain/event-item-start.vo.js'
import {
  EventItem,
  type EventItemSnapshot,
  type NewEventItemProps,
} from '../domain/event-item.entity.js'
import { EventItemRepository } from '../domain/event-item.repository.js'

@Injectable()
export class PrismaEventItemRepository extends EventItemRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async findInEvent(eventId: number, itemId: number): Promise<EventItem | null> {
    const row = await this.unitOfWork.client.eventItem.findFirst({ where: { id: itemId, eventId } })
    return row ? toDomain(row) : null
  }

  // FOR UPDATE holds the item's row until the transaction ends.
  async lockInEvent(eventId: number, itemId: number): Promise<EventItem | null> {
    const tx = this.unitOfWork.transaction()
    const locked = await tx.$queryRaw<{ id: number }[]>`
      SELECT id FROM event_items WHERE id = ${itemId} AND "eventId" = ${eventId} FOR UPDATE`
    if (locked.length === 0) return null
    const row = await tx.eventItem.findUnique({ where: { id: itemId } })
    return row ? toDomain(row) : null
  }

  async findAllInEvent(eventId: number): Promise<EventItem[]> {
    const rows = await this.unitOfWork.client.eventItem.findMany({
      where: { eventId },
      orderBy: { id: 'asc' },
    })
    return rows.map(toDomain)
  }

  async create(props: NewEventItemProps, stamp: Stamp): Promise<EventItem> {
    const row = await this.unitOfWork.client.eventItem.create({
      data: {
        eventId: props.eventId,
        position: props.position,
        name: props.name.value,
        ...startColumns(props.start),
        ...placeColumns(props.place),
        ...createdWith(stamp),
      },
    })
    return toDomain(row)
  }

  async save(item: EventItem): Promise<void> {
    await this.unitOfWork.client.eventItem.update({
      where: { id: item.id },
      data: {
        name: item.name,
        ...startColumns(item.start),
        ...placeColumns(item.place),
        position: item.position,
        updatedAt: item.updatedAt,
        updatedById: item.updatedById,
      },
    })
  }

  async delete(itemId: number): Promise<void> {
    await this.unitOfWork.client.eventItem.delete({ where: { id: itemId } })
  }
}

/**
 * A DATE column comes and goes as a JS Date at UTC midnight: only the
 * calendar day is read or written, so no zone ever shifts it. The time is
 * kept as the `HH:mm` text it travels as.
 */
function startColumns(start: EventItemStart) {
  return {
    date: start.date === null ? null : new Date(`${start.date.value}T00:00:00.000Z`),
    time: start.time?.value ?? null,
  }
}

function placeColumns(place: EventItemPlace | null) {
  const values = place?.toValues()
  return {
    placeName: values?.name ?? null,
    placeAddress: values?.address ?? null,
    placeTimezone: values?.timezone ?? null,
  }
}

/** A row as the plain data of the schedule (ADR-0019); shared with the read port. */
export function snapshotOf(row: PrismaEventItem): EventItemSnapshot {
  const hasPlace = row.placeName !== null || row.placeAddress !== null || row.placeTimezone !== null
  return {
    id: row.id,
    name: row.name,
    date: row.date === null ? null : row.date.toISOString().slice(0, 10),
    time: row.time,
    place: hasPlace
      ? { name: row.placeName, address: row.placeAddress, timezone: row.placeTimezone }
      : null,
    state: row.state,
    position: row.position,
  }
}

function toDomain(row: PrismaEventItem): EventItem {
  const snapshot = snapshotOf(row)
  return EventItem.restore({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    start: EventItemStart.create({ date: snapshot.date, time: snapshot.time }),
    place: snapshot.place === null ? null : EventItemPlace.create(snapshot.place),
    state: row.state,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
