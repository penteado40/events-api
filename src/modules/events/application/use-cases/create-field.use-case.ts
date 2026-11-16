import { positionAfter } from '../../domain/event-item-order.js'
import { fieldChanges } from '../../domain/field-changes.js'
import {
  type Field,
  type FieldKind,
  FieldName,
  FieldText,
  textValue,
} from '../../domain/field.entity.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { writeFieldsOf } from '../field-write.js'

export interface CreateFieldInput {
  actor: ActingUser
  eventId: number
  itemId: number
  /** The type the Field is born with, for good: a Field never mixes types. */
  kind: FieldKind
  name: string
  /** The text; it may be empty. */
  value: string
}

export type CreateFieldOutput = Field

/**
 * An Owner of its Group, or the Super admin, adds a Field of text to an Event
 * item ("Obs: despachar som", "Voo G3 1234"; a list, a phone and a link are
 * text too), last among its Fields. Frozen in a Cancelled Event or item
 * (writeFieldsOf). The new Field is a Change of the item that the people it
 * reaches see (fieldChanges), written in the same unit of work (amendment of
 * ADR-0010).
 */
export class CreateFieldUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: CreateFieldInput): Promise<CreateFieldOutput> {
    const name = FieldName.create(input.name)
    const text = FieldText.create(input.value)
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    return writeFieldsOf(this.deps, input.actor, input, async ({ item, reach }) => {
      const fields = await this.deps.fields.findAllInItem(item.id)
      const field = await this.deps.fields.create(
        {
          eventItemId: item.id,
          name,
          value: textValue(text),
          position: positionAfter(fields),
        },
        stamp,
      )
      await this.deps.changeLog.create(
        item.eventId,
        fieldChanges(null, field.snapshot(), item.snapshot(), reach),
        stamp,
      )
      return field
    })
  }
}
