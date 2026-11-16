import type { Field } from '../domain/field.entity.js'
import type { ScheduleField } from '../domain/schedule.js'
import type { FieldJson, FieldWriteJson } from './dto/field.dto.js'

export const FieldPresenter = {
  /** A Field as a write returns it; technical instants in ISO 8601 UTC. */
  toJson(field: Field): FieldWriteJson {
    return {
      id: field.id,
      eventItemId: field.eventItemId,
      kind: field.value.kind,
      name: field.name,
      value: field.value.text,
      createdAt: field.createdAt.toISOString(),
      updatedAt: field.updatedAt.toISOString(),
    }
  },

  /** A Field as the schedule shows it. */
  scheduleToJson(field: ScheduleField): FieldJson {
    return { id: field.id, kind: field.kind, name: field.name, value: field.value }
  },
}
