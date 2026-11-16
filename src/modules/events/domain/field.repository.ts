import type { Stamp } from '../../../shared/domain/stamp.js'
import type { Field, NewFieldProps } from './field.entity.js'

/**
 * The Fields of the Event items, for the writes. Every write of a Field holds
 * its item's row first (EventItemRepository.lockInEvent), so the Fields of an
 * item read after it are the ones that stand when the write lands.
 */
export abstract class FieldRepository {
  /** The Fields of the item, in the order of the production. */
  abstract findAllInItem(eventItemId: number): Promise<Field[]>
  /** The Fields of every Event item of the Event, in any order. */
  abstract findAllInEvent(eventId: number): Promise<Field[]>
  abstract create(props: NewFieldProps, stamp: Stamp): Promise<Field>
  abstract save(field: Field): Promise<void>
  abstract delete(fieldId: number): Promise<void>
}
