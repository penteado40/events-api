import { Injectable } from '@nestjs/common'
import type { EventItemField as FieldRow } from '../../../generated/prisma/client.js'
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

@Injectable()
export class PrismaFieldRepository extends FieldRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super()
  }

  async findAllInItem(eventItemId: number): Promise<Field[]> {
    const rows = await this.unitOfWork.client.eventItemField.findMany({
      where: { eventItemId },
      orderBy: [...FIELD_ORDER],
    })
    return rows.map(toDomain)
  }

  async findAllInEvent(eventId: number): Promise<Field[]> {
    const rows = await this.unitOfWork.client.eventItemField.findMany({
      where: { eventItem: { eventId } },
      orderBy: [...FIELD_ORDER],
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
        ...createdWith(stamp),
      },
    })
    return toDomain(row)
  }

  async save(field: Field): Promise<void> {
    await this.unitOfWork.client.eventItemField.update({
      where: { id: field.id },
      data: {
        name: field.name,
        position: field.position,
        ...valueColumns(field.value),
        updatedAt: field.updatedAt,
        updatedById: field.updatedById,
      },
    })
  }

  async delete(fieldId: number): Promise<void> {
    await this.unitOfWork.client.eventItemField.delete({ where: { id: fieldId } })
  }
}

/** Each type in its own column: a new type adds its own, and the rows there are stay as they are. */
function valueColumns(value: FieldValue) {
  return { kind: value.kind, textValue: value.text }
}

/** A row as the plain data of the schedule (ADR-0019); shared with the read port. */
export function fieldSnapshotOf(row: FieldRow): FieldSnapshot {
  return {
    id: row.id,
    eventItemId: row.eventItemId,
    name: row.name,
    value: { kind: row.kind, text: row.textValue ?? '' },
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
