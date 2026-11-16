import type { FieldView } from '../application/field-view.js'
import type { ScheduleField } from '../domain/schedule.js'
import type { FieldJson, FieldWriteJson } from './dto/field.dto.js'

export const FieldPresenter = {
  /** A Field as a write returns it, its people by name; technical instants in ISO 8601 UTC. */
  toJson({ field, shown }: FieldView): FieldWriteJson {
    return {
      ...FieldPresenter.scheduleToJson(shown),
      eventItemId: field.eventItemId,
      createdAt: field.createdAt.toISOString(),
      updatedAt: field.updatedAt.toISOString(),
    }
  },

  /** A Field as the schedule shows it. */
  scheduleToJson(field: ScheduleField): FieldJson {
    const value = field.kind === 'TEXT' ? field.value : field.value.map((p) => ({ ...p }))
    return { id: field.id, kind: field.kind, name: field.name, value }
  },
}
