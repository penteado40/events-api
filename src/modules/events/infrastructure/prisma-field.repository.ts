import { Injectable } from '@nestjs/common'
import type { EventItemField as PrismaField } from '../../../generated/prisma/client.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaUnitOfWork } from '../../../shared/infrastructure/prisma-unit-of-work.js'
import {
  Field,
  type FieldSnapshot,
  type FieldValue,
  type NewFieldProps,
} from '../domain/field.entity.js'
import { FieldRepository } from '../domain/field.repository.js'

/** The order of the production of the Fields, for a stable read; the assembly sorts again. */
export const FIELD_ORDER = [{ position: 'asc' }, { id: 'asc' }] as const

/** What every read of a Field brings along: the people of a people Field, in their order. */
export const WITH_PEOPLE = {
  people: { select: { userId: true }, orderBy: { position: 'asc' } },
} as const

/** A row of a Field with the people in it. */
export type FieldRow = PrismaField & { people: { userId: number }[] }

@Injectable()
export class PrismaFieldRepository extends FieldRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async findAllInItem(eventItemId: number): Promise<Field[]> {
    const rows = await this.unitOfWork.client.eventItemField.findMany({
      where: { eventItemId },
      orderBy: [...FIELD_ORDER],
      include: WITH_PEOPLE,
    })
    return rows.map(toDomain)
  }

  async findAllInEvent(eventId: number): Promise<Field[]> {
    const rows = await this.unitOfWork.client.eventItemField.findMany({
      where: { eventItem: { eventId } },
      orderBy: [...FIELD_ORDER],
      include: WITH_PEOPLE,
    })
    return rows.map(toDomain)
  }

  async create(props: NewFieldProps, stamp: Stamp): Promise<Field> {
    const row = await this.unitOfWork.client.eventItemField.create({
      data: {
        eventItemId: props.eventItemId,
        name: props.name.value,
        position: props.position,
        ...valueColumns(props.value),
        people: {
          create: peopleOf(props.value).map((userId, i) => ({
            userId,
            position: i + 1,
            ...createdWith(stamp),
          })),
        },
        ...createdWith(stamp),
      },
      include: WITH_PEOPLE,
    })
    return toDomain(row)
  }

  async save(field: Field): Promise<void> {
    const client = this.unitOfWork.client
    await client.eventItemField.update({
      where: { id: field.id },
      data: {
        name: field.name,
        position: field.position,
        ...valueColumns(field.value),
        updatedAt: field.updatedAt,
        updatedById: field.updatedById,
      },
    })
    if (field.value.kind !== 'PEOPLE') return
    // The people: who stays keeps their row, its Author included, unless they
    // move; who comes in, or moves, is written by the Field's last Author, at
    // its last write.
    const userIds = field.value.userIds
    const stamp = { by: field.updatedById, at: field.updatedAt }
    await client.eventItemFieldPerson.deleteMany({
      where: { fieldId: field.id, userId: { notIn: userIds } },
    })
    for (const [i, userId] of userIds.entries()) {
      await client.eventItemFieldPerson.updateMany({
        where: { fieldId: field.id, userId, position: { not: i + 1 } },
        data: { position: i + 1, updatedAt: stamp.at, updatedById: stamp.by },
      })
    }
    if (userIds.length > 0) {
      await client.eventItemFieldPerson.createMany({
        data: userIds.map((userId, i) => ({
          fieldId: field.id,
          userId,
          position: i + 1,
          ...createdWith(stamp),
        })),
        skipDuplicates: true,
      })
    }
  }

  async delete(fieldId: number): Promise<void> {
    await this.unitOfWork.client.eventItemField.delete({ where: { id: fieldId } })
  }
}

/** Each type in its own column or table: a new type adds its own, and the rows there are stay as they are. */
function valueColumns(value: FieldValue) {
  return { kind: value.kind, textValue: value.kind === 'TEXT' ? value.text : null }
}

function peopleOf(value: FieldValue): number[] {
  return value.kind === 'PEOPLE' ? value.userIds : []
}

/** A row as the plain data of the schedule (ADR-0019); shared with the read port. */
export function fieldSnapshotOf(row: FieldRow): FieldSnapshot {
  return {
    id: row.id,
    eventItemId: row.eventItemId,
    name: row.name,
    value:
      row.kind === 'TEXT'
        ? { kind: 'TEXT', text: row.textValue ?? '' }
        : { kind: 'PEOPLE', userIds: row.people.map((p) => p.userId) },
    position: row.position,
  }
}

function toDomain(row: FieldRow): Field {
  const snapshot = fieldSnapshotOf(row)
  return Field.restore({
    ...snapshot,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
