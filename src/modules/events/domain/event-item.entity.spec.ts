import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { EventItemStart } from './event-item-start.vo.js'
import { EventItem, type EventItemState } from './event-item.entity.js'
import type { EventState } from './event.entity.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

function itemIn(state: EventItemState): EventItem {
  return EventItem.restore({
    id: 1,
    eventId: 1,
    name: 'Passagem de som',
    start: EventItemStart.create({ date: '2026-11-14', time: '15:00' }),
    place: null,
    state,
    position: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    createdById: null,
    updatedById: null,
  })
}

describe('EventItem', () => {
  describe('bornIn', () => {
    it.each<[EventState, EventItemState]>([
      ['DRAFT', 'PUBLISHED'],
      ['PUBLISHED', 'DRAFT'],
    ])('in an Event in %s, an Event item is born %s', (eventState, itemState) => {
      expect(EventItem.bornIn(eventState)).toBe(itemState)
    })
  })

  describe('publish', () => {
    it('moves an Event item in Draft to published, as its Author', () => {
      const item = itemIn('DRAFT')

      item.publish({ by: 2, at: NOW })

      expect(item.state).toBe('PUBLISHED')
      expect(item.updatedAt).toBe(NOW)
      expect(item.updatedById).toBe(2)
    })

    it('refuses a published Event item with EVENT_ITEM_NOT_DRAFT, leaving it as it was', () => {
      const item = itemIn('PUBLISHED')

      expect(() => item.publish({ by: 2, at: NOW })).toThrow(new AppError('EVENT_ITEM_NOT_DRAFT'))
      expect(item.state).toBe('PUBLISHED')
      expect(item.updatedAt).toBe(CREATED_AT)
      expect(item.updatedById).toBeNull()
    })
  })
})
