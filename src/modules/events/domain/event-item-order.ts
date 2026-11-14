import { AppError } from '../../../shared/domain/app-error.js'
import type { NewChange } from './change.js'
import type { GroupMemberRole } from './event-access-policy.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import { byOrderOfTheProduction } from './schedule.js'

/** An Event item's new manual position. */
export interface EventItemPosition {
  id: number
  position: number
}

export interface EventItemReorder {
  /** Only the items whose position changes; empty when the order is the same. */
  positions: EventItemPosition[]
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
 * and the order never passes over the time. Ids given twice are
 * VALIDATION_ERROR, an id not of the Event is NOT_FOUND, items of more than
 * one group are EVENT_ITEM_ORDER_MIXED, and an item of the group left out is
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
  if (new Set(orderedIds).size !== orderedIds.length) throw new AppError('VALIDATION_ERROR')
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

  // The group's slots, apart: a tie of the position (two equal) would let the new order slip.
  const slots: number[] = []
  for (const item of group) {
    const last = slots.at(-1)
    slots.push(last === undefined || item.position > last ? item.position : last + 1)
  }
  const positions = ordered
    .map((item, i) => ({ id: item.id, position: slots[i] as number }))
    .filter(({ id, position }) => byId.get(id)?.position !== position)
  const reach = members.map((m) => m.userId)
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
