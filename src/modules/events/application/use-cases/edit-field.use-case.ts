import { AppError } from '../../../../shared/domain/app-error.js'
import { fieldChanges } from '../../domain/field-changes.js'
import {
  FieldName,
  FieldPeople,
  FieldText,
  type PersonEntry,
  usersIn,
} from '../../domain/field.entity.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { type FieldView, viewField } from '../field-view.js'
import { writeFieldsOf } from '../field-write.js'

export interface EditFieldInput {
  actor: ActingUser
  eventId: number
  itemId: number
  fieldId: number
  name?: string
  /** The new text of a TEXT Field. */
  value?: string
  /** The new people of a PEOPLE Field, Users and loose names, the whole list, in its new order. */
  people?: PersonEntry[]
}

export type EditFieldOutput = FieldView

/**
 * An Owner of its Group, or the Super admin, edits the name or the value of a
 * Field of an Event item: the text of a text Field, or the people of a
 * people Field, the whole list in its new order, Users and loose names (a
 * loose name renamed is the list with the new name): every User who comes in
 * must be a Participant of the Event (NOT_A_PARTICIPANT), and who was already in stays
 * even after leaving the Event; what is left out stays as it is, and a value of
 * the other type is VALIDATION_ERROR. A Field of another item is NOT_FOUND.
 * Frozen in a Cancelled Event or item (writeFieldsOf). The edit is a Change
 * of the item, with the Field and the reach before and after (fieldChanges):
 * whoever is put in a people Field starts being reached by the item, whoever
 * is taken out stops, written in the same unit of work (amendment of
 * ADR-0010); an edit that changes nothing writes nothing.
 */
export class EditFieldUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: EditFieldInput): Promise<EditFieldOutput> {
    const edit = {
      name: input.name === undefined ? undefined : FieldName.create(input.name),
      text: input.value === undefined ? undefined : FieldText.create(input.value),
      people: input.people === undefined ? undefined : FieldPeople.create(input.people),
    }
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    const field = await writeFieldsOf(
      this.deps,
      input.actor,
      input,
      async ({ item, fields, reach }) => {
        const field = fields.find((f) => f.id === input.fieldId)
        if (!field) throw new AppError('NOT_FOUND')
        const before = field.snapshot()
        // Only of a people Field: people for a text Field are refused by Field.edit, as VALIDATION_ERROR.
        if (field.value.kind === 'PEOPLE') {
          edit.people?.assertWithin(reach.participants, usersIn(field.value.people))
        }
        // An edit that changes nothing writes nothing: no row, no Change.
        if (!field.edit(edit, stamp)) return field
        await this.deps.fields.save(field)
        await this.deps.changeLog.create(
          item.eventId,
          fieldChanges(
            before,
            field.snapshot(),
            item.snapshot(),
            fields.map((f) => (f.id === field.id ? before : f.snapshot())),
            reach,
          ),
          stamp,
        )
        return field
      },
    )
    return viewField(field, this.deps.users)
  }
}
