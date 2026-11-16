import { AppError } from '../../../../shared/domain/app-error.js'
import { fieldChanges } from '../../domain/field-changes.js'
import { type Field, FieldName, FieldText } from '../../domain/field.entity.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { writeFieldsOf } from '../field-write.js'

export interface EditFieldInput {
  actor: ActingUser
  eventId: number
  itemId: number
  fieldId: number
  name?: string
  value?: string
}

export type EditFieldOutput = Field

/**
 * An Owner of its Group, or the Super admin, edits the name or the value of a
 * Field of an Event item; what is left out stays as it is. A Field of another
 * item is NOT_FOUND. Frozen in a Cancelled Event or item (writeFieldsOf). The
 * edit is a Change of the item, with the Field before and after
 * (fieldChanges), written in the same unit of work (amendment of ADR-0010);
 * an edit that changes nothing writes nothing.
 */
export class EditFieldUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: EditFieldInput): Promise<EditFieldOutput> {
    const edit = {
      name: input.name === undefined ? undefined : FieldName.create(input.name),
      text: input.value === undefined ? undefined : FieldText.create(input.value),
    }
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    return writeFieldsOf(this.deps, input.actor, input, async ({ item, reach }) => {
      const fields = await this.deps.fields.findAllInItem(item.id)
      const field = fields.find((f) => f.id === input.fieldId)
      if (!field) throw new AppError('NOT_FOUND')
      const before = field.snapshot()
      // An edit that changes nothing writes nothing: no row, no Change.
      if (!field.edit(edit, stamp)) return field
      await this.deps.fields.save(field)
      await this.deps.changeLog.create(
        item.eventId,
        fieldChanges(before, field.snapshot(), item.snapshot(), reach),
        stamp,
      )
      return field
    })
  }
}
