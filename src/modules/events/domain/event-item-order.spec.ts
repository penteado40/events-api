import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import type { GroupMemberRole } from './event-access-policy.js'
import type { EventItemSnapshot } from './event-item.entity.js'
import { positionAfter, reorderEventItems } from './event-item-order.js'

function item(id: number, name: string, over: Partial<EventItemSnapshot> = {}): EventItemSnapshot {
  return {
    id,
    name,
    date: null,
    time: null,
    place: null,
    state: 'PUBLISHED',
    position: id,
    ...over,
  }
}

// The Manaus trip: two vans at 10h on Friday, a lunch and a day off with no
// time on Saturday, and two items of the General info.
const ITEMS: EventItemSnapshot[] = [
  item(1, 'O que levar'),
  item(2, 'Van 1', { date: '2026-11-13', time: '10:00' }),
  item(3, 'Van 2', { date: '2026-11-13', time: '10:00' }),
  item(4, 'Café', { date: '2026-11-13', time: '09:00' }),
  item(5, 'Almoço', { date: '2026-11-14' }),
  item(6, 'Contatos da produção'),
  item(7, 'Dia de folga da Banda', { date: '2026-11-14' }),
]

const MEMBERS: GroupMemberRole[] = [
  { userId: 10, role: 'OWNER' },
  { userId: 11, role: 'VIEWER' },
]

describe('reorderEventItems', () => {
  it('gives the items of the General info the slots of the group in the new order', () => {
    const { positions } = reorderEventItems(ITEMS, [6, 1], MEMBERS)

    expect(positions).toEqual([
      { id: 6, position: 1 },
      { id: 1, position: 6 },
    ])
  })

  it('reorders two items at the same time', () => {
    const { positions } = reorderEventItems(ITEMS, [3, 2], MEMBERS)

    expect(positions).toEqual([
      { id: 3, position: 2 },
      { id: 2, position: 3 },
    ])
  })

  it('reorders the items of a day with no time', () => {
    const { positions } = reorderEventItems(ITEMS, [7, 5], MEMBERS)

    expect(positions).toEqual([
      { id: 7, position: 5 },
      { id: 5, position: 7 },
    ])
  })

  it('records one Change of the Event that only the production sees, the order before and after', () => {
    const { changes } = reorderEventItems(ITEMS, [3, 2], MEMBERS)

    expect(changes).toEqual([
      {
        eventItemId: null,
        attribute: 'itemOrder',
        before: [2, 3],
        after: [3, 2],
        productionOnly: true,
        reachBefore: [10, 11],
        reachAfter: [10, 11],
      },
    ])
  })

  it('changes nothing and records nothing when the order is the same', () => {
    expect(reorderEventItems(ITEMS, [2, 3], MEMBERS)).toEqual({ positions: [], changes: [] })
  })

  it('takes the order as it stands, ties of the position by the order of creation', () => {
    const tied = [item(8, 'A', { position: 1 }), item(9, 'B', { position: 1 })]

    const { positions, changes } = reorderEventItems(tied, [9, 8], MEMBERS)

    expect(changes[0]).toMatchObject({ before: [8, 9], after: [9, 8] })
    // The slots stay apart, so the new order holds without the tie: B keeps 1, A moves to 2.
    expect(positions).toEqual([{ id: 8, position: 2 }])
  })

  it('refuses items where the time decides: EVENT_ITEM_ORDER_MIXED', () => {
    // 9h and 10h on the same day: the time already orders them.
    expect(() => reorderEventItems(ITEMS, [4, 2, 3], MEMBERS)).toThrow(
      new AppError('EVENT_ITEM_ORDER_MIXED'),
    )
    // A day with no time and the General info are not one tie either.
    expect(() => reorderEventItems(ITEMS, [5, 7, 1, 6], MEMBERS)).toThrow(
      new AppError('EVENT_ITEM_ORDER_MIXED'),
    )
  })

  it('refuses a group left incomplete: EVENT_ITEM_ORDER_INCOMPLETE', () => {
    const withVan3 = [...ITEMS, item(8, 'Van 3', { date: '2026-11-13', time: '10:00' })]

    expect(() => reorderEventItems(withVan3, [3, 2], MEMBERS)).toThrow(
      new AppError('EVENT_ITEM_ORDER_INCOMPLETE'),
    )
  })

  it('refuses an item that is not of the Event: NOT_FOUND', () => {
    expect(() => reorderEventItems(ITEMS, [2, 99], MEMBERS)).toThrow(new AppError('NOT_FOUND'))
  })

  it('refuses an empty order: VALIDATION_ERROR', () => {
    expect(() => reorderEventItems(ITEMS, [], MEMBERS)).toThrow(new AppError('VALIDATION_ERROR'))
  })

  it('refuses an item given twice: VALIDATION_ERROR', () => {
    expect(() => reorderEventItems(ITEMS, [2, 3, 2], MEMBERS)).toThrow(
      new AppError('VALIDATION_ERROR'),
    )
  })
})

describe('positionAfter', () => {
  it('puts a new item after every item of the Event, so last in its tie group', () => {
    expect(positionAfter([item(1, 'O que levar', { position: 7 }), item(2, 'Show')])).toBe(8)
  })

  it('starts the order at 1 in an Event with no items', () => {
    expect(positionAfter([])).toBe(1)
  })
})
