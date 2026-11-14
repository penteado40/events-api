import { describe, expect, it } from 'vitest'
import { AppError, type ErrorCode } from '../../../shared/domain/app-error.js'
import { EventItemName } from './event-item-name.vo.js'
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

  describe('cancel', () => {
    it('moves a published Event item to Cancelled, as its Author', () => {
      const item = itemIn('PUBLISHED')

      item.cancel({ by: 2, at: NOW })

      expect(item.state).toBe('CANCELLED')
      expect(item.updatedAt).toBe(NOW)
      expect(item.updatedById).toBe(2)
    })

    it.each<[EventItemState, ErrorCode]>([
      ['DRAFT', 'EVENT_ITEM_NOT_PUBLISHED'],
      ['CANCELLED', 'EVENT_ITEM_CANCELLED'],
    ])('refuses an Event item in %s with %s, leaving it as it was', (state, code) => {
      const item = itemIn(state)

      expect(() => item.cancel({ by: 2, at: NOW })).toThrow(new AppError(code))
      expect(item.state).toBe(state)
      expect(item.updatedAt).toBe(CREATED_AT)
      expect(item.updatedById).toBeNull()
    })
  })

  describe('uncancel', () => {
    it('gives a Cancelled Event item back to published, as its Author', () => {
      const item = itemIn('CANCELLED')

      item.uncancel({ by: 2, at: NOW })

      expect(item.state).toBe('PUBLISHED')
      expect(item.updatedAt).toBe(NOW)
      expect(item.updatedById).toBe(2)
    })

    it.each<EventItemState>(['DRAFT', 'PUBLISHED'])(
      'refuses an Event item in %s with EVENT_ITEM_NOT_CANCELLED, leaving it as it was',
      (state) => {
        const item = itemIn(state)

        expect(() => item.uncancel({ by: 2, at: NOW })).toThrow(
          new AppError('EVENT_ITEM_NOT_CANCELLED'),
        )
        expect(item.state).toBe(state)
        expect(item.updatedAt).toBe(CREATED_AT)
      },
    )
  })

  describe('a Cancelled Event item', () => {
    it('refuses an edit with EVENT_ITEM_CANCELLED, even one that changes nothing', () => {
      const item = itemIn('CANCELLED')

      expect(() => item.edit({ name: EventItemName.create('Bis') }, { by: 2, at: NOW })).toThrow(
        new AppError('EVENT_ITEM_CANCELLED'),
      )
      expect(() => item.edit({}, { by: 2, at: NOW })).toThrow(new AppError('EVENT_ITEM_CANCELLED'))
      expect(item.name).toBe('Passagem de som')
      expect(item.updatedAt).toBe(CREATED_AT)
    })

    it('refuses a publish with EVENT_ITEM_NOT_DRAFT', () => {
      const item = itemIn('CANCELLED')

      expect(() => item.publish({ by: 2, at: NOW })).toThrow(new AppError('EVENT_ITEM_NOT_DRAFT'))
      expect(item.state).toBe('CANCELLED')
    })
  })
})
