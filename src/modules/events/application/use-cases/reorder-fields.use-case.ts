import { reorderFields } from '../../domain/field-changes.js'
import { byFieldOrder, type Field } from '../../domain/field.entity.js'
import type { ActingUser } from '../actor.js'
import type { EventItemWriteDeps } from '../event-item-write-deps.js'
import { writeFieldsOf } from '../field-write.js'

export interface ReorderFieldsInput {
  actor: ActingUser
  eventId: number
  itemId: number
  /** Every Field of the item, as it stands, in the new order. */
  fieldIds: number[]
}

/** The Fields of the item, in the new order. */
export type ReorderFieldsOutput = Field[]

/**
 * An Owner of its Group, or the Super admin, puts the Fields of an Event item
 * in a new order (reorderFields). Frozen in a Cancelled Event or item
 * (writeFieldsOf). The new order is one Change of the item that only the
 * production sees, written in the same unit of work (amendment of ADR-0010);
 * each Field that moves has who reordered as its Author (ADR-0013). The same
 * order writes nothing.
 */
export class ReorderFieldsUseCase {
  constructor(private readonly deps: EventItemWriteDeps) {}

  async execute(input: ReorderFieldsInput): Promise<ReorderFieldsOutput> {
    const stamp = { by: input.actor.id, at: this.deps.clock.now() }
    return writeFieldsOf(this.deps, input.actor, input, async ({ item, reach }) => {
      const fields = await this.deps.fields.findAllInItem(item.id)
      const { positions, changes } = reorderFields(
        fields.map((field) => field.snapshot()),
        input.fieldIds,
        item.snapshot(),
        reach,
      )
      if (changes.length > 0) {
        const byId = new Map(fields.map((field) => [field.id, field]))
        for (const { id, position } of positions) {
          const field = byId.get(id)
          if (!field) continue
          field.moveTo(position, stamp)
          await this.deps.fields.save(field)
        }
        await this.deps.changeLog.create(item.eventId, changes, stamp)
      }
      return [...fields].sort(byFieldOrder)
    })
  }
}
