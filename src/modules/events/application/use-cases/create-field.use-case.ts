import { AppError } from '../../../../shared/domain/app-error.js'
import { positionAfter } from '../../domain/event-item-order.js'
import { fieldChanges } from '../../domain/field-changes.js'
import {
  type FieldKind,
  FieldName,
  FieldPeople,
  FieldText,
  type FieldValue,
  peopleValue,
  textValue,
} from '../../domain/field.entity.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { type FieldView, viewField } from '../field-view.js'
import { writeFieldsOf } from '../field-write.js'

export interface CreateFieldInput {
  actor: ActingUser
  eventId: number
  itemId: number
  /** The type the Field is born with, for good: a Field never mixes types. */
  kind: FieldKind
  name: string
  /** The text of a TEXT Field; it may be empty. Only for TEXT. */
  value?: string
  /** The User ids of a PEOPLE Field, in order; it may be empty. Only for PEOPLE. */
  userIds?: number[]
}

export type CreateFieldOutput = FieldView

/**
 * An Owner of its Group, or the Super admin, adds a Field to an Event item,
 * last among its Fields: of text ("Obs: despachar som", "Voo G3 1234"; a
 * list, a phone and a link are text too) or of people ("Carro 1 - EC:
 * Matias, Jacque", in the order given). Only Participants of the Event go in
 * a people Field (NOT_A_PARTICIPANT), read under the Event's lock; whoever is
 * in it is in the item's Audience while there. Frozen in a Cancelled Event or
 * item (writeFieldsOf). The new Field is a Change of the item that the people
 * it reaches see, with the reach before and after (fieldChanges), written in
 * the same unit of work (amendment of ADR-0010).
 */
export class CreateFieldUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: CreateFieldInput): Promise<CreateFieldOutput> {
    const name = FieldName.create(input.name)
    const { value, people } = newValue(input)
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    const field = await writeFieldsOf(
      this.deps,
      input.actor,
      input,
      async ({ item, fields, reach }) => {
        // The Participants are held with the Event: one taken off meanwhile does not go in.
        people?.assertWithin(reach.participants, [])
        const field = await this.deps.fields.create(
          { eventItemId: item.id, name, value, position: positionAfter(fields) },
          stamp,
        )
        await this.deps.changeLog.create(
          item.eventId,
          fieldChanges(
            null,
            field.snapshot(),
            item.snapshot(),
            fields.map((f) => f.snapshot()),
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

/** The value of the new Field, of its own type only: the other type's value is VALIDATION_ERROR. */
function newValue(input: CreateFieldInput): { value: FieldValue; people: FieldPeople | null } {
  if (input.kind === 'TEXT') {
    if (input.value === undefined || input.userIds !== undefined) {
      throw new AppError('VALIDATION_ERROR')
    }
    return { value: textValue(FieldText.create(input.value)), people: null }
  }
  if (input.userIds === undefined || input.value !== undefined) {
    throw new AppError('VALIDATION_ERROR')
  }
  const people = FieldPeople.create(input.userIds)
  return { value: peopleValue(people), people }
}
