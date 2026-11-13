import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { EventName } from './event-name.vo.js'
import { EventPeriod } from './event-period.vo.js'
import { Event, type EventState } from './event.entity.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

/** An Event in that state; a Cancelled one was cancelled from `cancelledFrom` (Draft unless told). */
function eventIn(state: EventState, cancelledFrom: 'DRAFT' | 'PUBLISHED' = 'DRAFT'): Event {
  return Event.restore({
    id: 1,
    groupId: 1,
    name: 'Show em Manaus',
    place: 'Manaus',
    period: EventPeriod.create({
      startDate: '2026-11-13',
      endDate: '2026-11-16',
      timezone: 'America/Manaus',
    }),
    state,
    cancelledFrom: state === 'CANCELLED' ? cancelledFrom : null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    createdById: null,
    updatedById: null,
  })
}

describe('Event', () => {
  describe('publish', () => {
    it('moves an Event in Draft to published, as its Author', () => {
      const event = eventIn('DRAFT')

      event.publish({ by: 2, at: NOW })

      expect(event.state).toBe('PUBLISHED')
      expect(event.updatedAt).toBe(NOW)
      expect(event.updatedById).toBe(2)
    })

    it('refuses a published Event with EVENT_NOT_DRAFT, leaving it as it was', () => {
      const event = eventIn('PUBLISHED')

      expect(() => event.publish({ by: 2, at: NOW })).toThrow(new AppError('EVENT_NOT_DRAFT'))
      expect(event.state).toBe('PUBLISHED')
      expect(event.updatedAt).toBe(CREATED_AT)
      expect(event.updatedById).toBeNull()
    })

    it('refuses a Cancelled Event with EVENT_CANCELLED: it is frozen', () => {
      const event = eventIn('CANCELLED')

      expect(() => event.publish({ by: 2, at: NOW })).toThrow(new AppError('EVENT_CANCELLED'))
      expect(event.state).toBe('CANCELLED')
      expect(event.updatedAt).toBe(CREATED_AT)
    })
  })

  describe('cancel', () => {
    it.each<EventState>(['DRAFT', 'PUBLISHED'])(
      'cancels an Event in %s, as its Author',
      (state) => {
        const event = eventIn(state)

        event.cancel({ by: 2, at: NOW })

        expect(event.state).toBe('CANCELLED')
        expect(event.isCancelled).toBe(true)
        expect(event.updatedAt).toBe(NOW)
        expect(event.updatedById).toBe(2)
      },
    )

    it('refuses an Event already Cancelled with EVENT_CANCELLED, leaving it as it was', () => {
      const event = eventIn('CANCELLED', 'PUBLISHED')

      expect(() => event.cancel({ by: 2, at: NOW })).toThrow(new AppError('EVENT_CANCELLED'))
      expect(event.updatedAt).toBe(CREATED_AT)
      event.uncancel({ by: 2, at: NOW })
      expect(event.state).toBe('PUBLISHED')
    })
  })

  describe('uncancel', () => {
    it.each<EventState>(['DRAFT', 'PUBLISHED'])(
      'gives an Event cancelled in %s back its state before, as its Author',
      (state) => {
        const event = eventIn(state)
        event.cancel({ by: 2, at: CREATED_AT })

        event.uncancel({ by: 3, at: NOW })

        expect(event.state).toBe(state)
        expect(event.isCancelled).toBe(false)
        expect(event.updatedAt).toBe(NOW)
        expect(event.updatedById).toBe(3)
      },
    )

    it('gives back the state an Event was cancelled from when it was read that way', () => {
      const event = eventIn('CANCELLED', 'PUBLISHED')

      event.uncancel({ by: 2, at: NOW })

      expect(event.state).toBe('PUBLISHED')
    })

    it.each<EventState>(['DRAFT', 'PUBLISHED'])(
      'refuses an Event in %s with EVENT_NOT_CANCELLED, leaving it as it was',
      (state) => {
        const event = eventIn(state)

        expect(() => event.uncancel({ by: 2, at: NOW })).toThrow(
          new AppError('EVENT_NOT_CANCELLED'),
        )
        expect(event.state).toBe(state)
        expect(event.updatedAt).toBe(CREATED_AT)
      },
    )
  })

  describe('while Cancelled', () => {
    it('refuses an edit with EVENT_CANCELLED, leaving it as it was', () => {
      const event = eventIn('CANCELLED')

      expect(() =>
        event.edit({ name: EventName.create('Show em Belém') }, { by: 2, at: NOW }),
      ).toThrow(new AppError('EVENT_CANCELLED'))
      expect(event.name).toBe('Show em Manaus')
      expect(event.updatedAt).toBe(CREATED_AT)
    })

    it('refuses even an edit that changes nothing with EVENT_CANCELLED', () => {
      const event = eventIn('CANCELLED')

      expect(() => event.edit({}, { by: 2, at: NOW })).toThrow(new AppError('EVENT_CANCELLED'))
    })

    it('refuses any write in its Event items with EVENT_CANCELLED', () => {
      expect(() => eventIn('CANCELLED').assertWritable()).toThrow(new AppError('EVENT_CANCELLED'))
    })

    it.each<EventState>(['DRAFT', 'PUBLISHED'])('takes writes again in %s', (state) => {
      const event = eventIn(state)
      event.cancel({ by: 2, at: CREATED_AT })
      event.uncancel({ by: 2, at: CREATED_AT })

      expect(() => event.assertWritable()).not.toThrow()
      event.edit({ name: EventName.create('Show em Belém') }, { by: 3, at: NOW })
      expect(event.name).toBe('Show em Belém')
    })
  })
})
