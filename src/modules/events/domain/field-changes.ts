import { AppError } from '../../../shared/domain/app-error.js'
import type { ChangeValue, NewChange } from './change.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import { eventItemReach, type ItemReachContext } from './event-item-reach.js'
import {
  byOrderOfTheProduction,
  dealPositions,
  type ManualPosition,
  namesEachItemOnce,
} from './event-item-order.js'
import { type FieldSnapshot, peopleInFields } from './field.entity.js'

/**
 * The Change of a Field, a Change of its Event item (CONTEXT.md, Change):
 * attribute `field`, with the Field as it was before and as it is after
 * (`{ fieldId, kind, name, value }`), null on the side where it does not
 * exist, so a creation, an edit of the name or the value and a removal are
 * one Change each (an edit that changes nothing is no write: Field.edit).
 * The value of a people Field is its entries in order, `{ userId }` or a loose
 * `{ name }`, so putting, renaming and taking out a loose name are Changes too,
 * that move no reach: a loose name reaches no one. The people the item
 * reaches see it: its reach before is the item's with its Fields as they
 * stood, and after, with this Field as it is now, so putting someone in a
 * people Field, or taking them out, moves the reach (CONTEXT.md, Audience).
 */
export function fieldChanges(
  before: FieldSnapshot | null,
  after: FieldSnapshot | null,
  item: EventItemSnapshot,
  /** Every Field of the item as it stood before the write, this one included if it existed. */
  fieldsBefore: readonly FieldSnapshot[],
  reach: ItemReachContext,
): NewChange[] {
  const changed = after ?? before
  if (changed === null) return []
  const fieldsAfter = fieldsBefore.filter((field) => field.id !== changed.id)
  if (after !== null) fieldsAfter.push(after)
  return [
    {
      eventItemId: item.id,
      attribute: 'field',
      before: fieldValue(before),
      after: fieldValue(after),
      productionOnly: false,
      reachBefore: eventItemReach(item, reach, peopleInFields(fieldsBefore)),
      reachAfter: eventItemReach(item, reach, peopleInFields(fieldsAfter)),
    },
  ]
}

export interface FieldReorder {
  /** Only the Fields whose position changes; empty when the order is the same. */
  positions: ManualPosition[]
  /** The Change of the new order, only for the production; empty when the order is the same. */
  changes: NewChange[]
}

/**
 * An Owner puts the Fields of an Event item in a new order: the ids given are
 * every Field of the item, as it stands, in the new order. An empty order or
 * an id given twice is VALIDATION_ERROR, an id not of the item is NOT_FOUND,
 * and a Field of the item left out is FIELD_ORDER_INCOMPLETE: the order is of
 * all of them, so one created meanwhile is never ordered blind. The Fields
 * keep the positions they had, dealt again in the new order (dealPositions).
 *
 * The new order is one Change of the item (attribute `fieldOrder`, the ids
 * before and after) that only the production sees (CONTEXT.md, Change).
 */
export function reorderFields(
  fields: readonly FieldSnapshot[],
  orderedIds: readonly number[],
  item: EventItemSnapshot,
  reach: ItemReachContext,
): FieldReorder {
  if (orderedIds.length === 0 || !namesEachItemOnce(orderedIds)) {
    throw new AppError('VALIDATION_ERROR')
  }
  const byId = new Map(fields.map((field) => [field.id, field]))
  if (orderedIds.some((id) => !byId.has(id))) throw new AppError('NOT_FOUND')
  if (orderedIds.length !== fields.length) throw new AppError('FIELD_ORDER_INCOMPLETE')

  const current = [...fields].sort(byOrderOfTheProduction)
  const before = current.map((field) => field.id)
  if (before.every((id, i) => id === orderedIds[i])) return { positions: [], changes: [] }

  const positions = dealPositions(current, orderedIds)
  const reachOfItem = eventItemReach(item, reach, peopleInFields(fields))
  return {
    positions,
    changes: [
      {
        eventItemId: item.id,
        attribute: 'fieldOrder',
        before,
        after: [...orderedIds],
        productionOnly: true,
        reachBefore: reachOfItem,
        reachAfter: [...reachOfItem],
      },
    ],
  }
}

/** The Field as its Change keeps it: what it was, with its id, never its position. */
function fieldValue(field: FieldSnapshot | null): ChangeValue {
  if (field === null) return null
  const value =
    field.value.kind === 'TEXT'
      ? field.value.text
      : field.value.people.map((entry) => ({ ...entry }))
  return { fieldId: field.id, kind: field.value.kind, name: field.name, value }
}
