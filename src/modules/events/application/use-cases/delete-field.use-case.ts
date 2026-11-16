import { AppError } from '../../../../shared/domain/app-error.js'
import { fieldChanges } from '../../domain/field-changes.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { writeFieldsOf } from '../field-write.js'

export interface DeleteFieldInput {
  actor: ActingUser
  eventId: number
  itemId: number
  fieldId: number
}

/**
 * An Owner of its Group, or the Super admin, deletes a Field of an Event
 * item. A Field of another item is NOT_FOUND. Frozen in a Cancelled Event or
 * item (writeFieldsOf). The removal is a Change of the item, with what the
 * Field was (fieldChanges), written in the same unit of work (amendment of
 * ADR-0010).
 */
export class DeleteFieldUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: DeleteFieldInput): Promise<void> {
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    await writeFieldsOf(this.deps, input.actor, input, async ({ item, reach }) => {
      const fields = await this.deps.fields.findAllInItem(item.id)
      const field = fields.find((f) => f.id === input.fieldId)
      if (!field) throw new AppError('NOT_FOUND')
      await this.deps.fields.delete(field.id)
      await this.deps.changeLog.create(
        item.eventId,
        fieldChanges(field.snapshot(), null, item.snapshot(), reach),
        stamp,
      )
    })
  }
}
