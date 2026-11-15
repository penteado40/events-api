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
import type { FieldSnapshot } from './field.entity.js'

/**
 * The Change of a Field, a Change of its Event item (CONTEXT.md, Change):
 * attribute `field`, with the Field as it was before and as it is after
 * (`{ fieldId, kind, name, value }`), null on the side where it does not
 * exist, so a creation, an edit of the name or the value and a removal are
 * one Change each. An edit that changes nothing is none. The people the item
 * reaches see it: its reach, before and after, is the item's, which the Field
 * does not change.
 */
export function fieldChanges(
  before: FieldSnapshot | null,
  after: FieldSnapshot | null,
  item: EventItemSnapshot,
  reach: ItemReachContext,
): NewChange[] {
  if (before === null && after === null) return []
  if (before !== null && after !== null && sameContent(before, after)) return []
  const reachOfItem = eventItemReach(item, reach)
  return [
    {
      eventItemId: item.id,
      attribute: 'field',
      before: fieldValue(before),
      after: fieldValue(after),
      productionOnly: false,
      reachBefore: reachOfItem,
      reachAfter: [...reachOfItem],
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
  const reachOfItem = eventItemReach(item, reach)
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
  return { fieldId: field.id, kind: field.value.kind, name: field.name, value: field.value.text }
}

function sameContent(a: FieldSnapshot, b: FieldSnapshot): boolean {
  return a.name === b.name && a.value.kind === b.value.kind && a.value.text === b.value.text
}
