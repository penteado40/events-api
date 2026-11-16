import { createdWith, type Stamp } from '../../../../shared/domain/stamp.js'
import { byOrderOfTheProduction } from '../../domain/event-item-order.js'
import { Field, type NewFieldProps } from '../../domain/field.entity.js'
import { FieldRepository } from '../../domain/field.repository.js'
import type { InMemoryEventItemRepository } from './in-memory-event-item.repository.js'

export class InMemoryFieldRepository extends FieldRepository {
  private readonly fields = new Map<number, Field>()
  private nextId = 1

  /** The items, to tell the Fields of an Event apart. */
  constructor(private readonly items: InMemoryEventItemRepository) {
    super()
  }

  async findAllInItem(eventItemId: number): Promise<Field[]> {
    return this.ofItem(eventItemId)
  }

  async findAllInEvent(eventId: number): Promise<Field[]> {
    const itemIds = new Set(this.items.ofEvent(eventId).map((item) => item.id))
    return [...this.fields.values()].filter((f) => itemIds.has(f.eventItemId))
  }

  async create(props: NewFieldProps, stamp: Stamp): Promise<Field> {
    const field = Field.restore({
      id: this.nextId++,
      eventItemId: props.eventItemId,
      name: props.name.value,
      value: props.value,
      position: props.position,
      highlight: props.highlight ?? false,
      ...createdWith(stamp),
    })
    this.fields.set(field.id, field)
    return field
  }

  async save(field: Field): Promise<void> {
    this.fields.set(field.id, field)
  }

  async delete(fieldId: number): Promise<void> {
    this.fields.delete(fieldId)
  }

  /** The Fields of the item, in the order of the production. Helper for the reader and for assertions. */
  ofItem(eventItemId: number): Field[] {
    return [...this.fields.values()]
      .filter((f) => f.eventItemId === eventItemId)
      .sort(byOrderOfTheProduction)
  }
}
