import { AppError } from '../../../shared/domain/app-error.js'
import type { NewChange } from './change.js'
import type { GroupMemberRole } from './event-access-policy.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import { eventReach } from './event-reach.js'

/** Something the production puts in order: an Event item, or a Field among those of its item. */
export interface ManuallyOrdered {
  id: number
  position: number
}

/** The order of the production: the manual position, then the order of creation. */
export function byOrderOfTheProduction(a: ManuallyOrdered, b: ManuallyOrdered): number {
  return a.position - b.position || a.id - b.id
}

/**
 * The position of something new: after every one there is, so last, whatever
 * order the Owners gave. For an Event item, after every item of the Event, so
 * last in its tie group, read under the Event's lock; for a Field, after the
 * Fields of its item, read under the item's lock. Two creations never take
 * the same one.
 */
export function positionAfter(items: readonly { position: number }[]): number {
  return Math.max(0, ...items.map((item) => item.position)) + 1
}

/**
 * A new order names each Event item, or each Field, once. The one rule,
 * checked by reorderEventItems and reorderFields and, for the 400 before the
 * access and the docs, by the request bodies.
 */
export function namesEachItemOnce(ids: readonly number[]): boolean {
  return new Set(ids).size === ids.length
}

/** A new manual position, of an Event item or a Field. */
export type ManualPosition = ManuallyOrdered

/**
 * Deals the positions the ones given already hold (in the order of the
 * production) again in the new order, so nothing else moves. Answers only
 * the ones whose position changes.
 */
export function dealPositions(
  current: readonly ManuallyOrdered[],
  orderedIds: readonly number[],
): ManualPosition[] {
  const held = new Map(current.map((one) => [one.id, one.position]))
  // The slots, apart: a tie of the position (two equal) would let the new order slip.
  const slots: number[] = []
  for (const one of current) {
    const last = slots.at(-1)
    slots.push(last === undefined || one.position > last ? one.position : last + 1)
  }
  return orderedIds
    .map((id, i) => ({ id, position: slots[i] as number }))
    .filter(({ id, position }) => held.get(id) !== position)
}

export interface EventItemReorder {
  /** Only the items whose position changes; empty when the order is the same. */
  positions: ManualPosition[]
  /** The Change of the new order, only for the production; empty when the order is the same. */
  changes: NewChange[]
}

/**
 * A tie group: the Event items whose order the time does not decide (CONTEXT.md,
 * Event item), those of the General info, those of one day with no time, or
 * those of one day at the same time. Two items are of one group when they
 * share both the date and the time, null included.
 */
function sameTie(a: EventItemSnapshot, b: EventItemSnapshot): boolean {
  return a.date === b.date && a.time === b.time
}

/**
 * An Owner puts a tie group in a new order (CONTEXT.md, Event item): the ids
 * given are the whole group, as it stands, in the new order. The group keeps
 * the positions it had, dealt again in the new order, so no other item moves
 * and the order never passes over the time. An empty order, or an id given
 * twice (namesEachItemOnce), is VALIDATION_ERROR, an id not of the Event is NOT_FOUND, items of more than one group are
 * EVENT_ITEM_ORDER_MIXED, and an item of the group left out is
 * EVENT_ITEM_ORDER_INCOMPLETE: the order is of the whole group, never half of
 * it, so a creation that came first is never ordered blind.
 *
 * The new order is one Change of the Event (attribute `itemOrder`, the ids
 * before and after), that only the production sees (CONTEXT.md, Change); its
 * reach, as on every Change of the Event, is every Group member given.
 */
export function reorderEventItems(
  items: readonly EventItemSnapshot[],
  orderedIds: readonly number[],
  members: readonly GroupMemberRole[],
): EventItemReorder {
  if (!namesEachItemOnce(orderedIds)) throw new AppError('VALIDATION_ERROR')
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = orderedIds.map((id) => {
    const item = byId.get(id)
    if (!item) throw new AppError('NOT_FOUND')
    return item
  })
  const [first] = ordered
  if (!first) throw new AppError('VALIDATION_ERROR')
  if (ordered.some((item) => !sameTie(item, first))) throw new AppError('EVENT_ITEM_ORDER_MIXED')
  const group = items.filter((item) => sameTie(item, first)).sort(byOrderOfTheProduction)
  if (group.length !== ordered.length) throw new AppError('EVENT_ITEM_ORDER_INCOMPLETE')

  const before = group.map((item) => item.id)
  if (before.every((id, i) => id === orderedIds[i])) return { positions: [], changes: [] }

  const positions = dealPositions(group, orderedIds)
  const reach = eventReach(members)
  return {
    positions,
    changes: [
      {
        eventItemId: null,
        attribute: 'itemOrder',
        before,
        after: [...orderedIds],
        productionOnly: true,
        reachBefore: reach,
        reachAfter: [...reach],
      },
    ],
  }
}
