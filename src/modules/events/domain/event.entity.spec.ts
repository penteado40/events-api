import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { EventPeriod } from './event-period.vo.js'
import { Event, type EventState } from './event.entity.js'

const CREATED_AT = new Date('2026-10-01T12:00:00.000Z')
const NOW = new Date('2026-11-01T12:00:00.000Z')

function eventIn(state: EventState): Event {
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

    it.each<EventState>(['PUBLISHED', 'CANCELLED'])(
      'refuses an Event in %s with EVENT_NOT_DRAFT, leaving it as it was',
      (state) => {
        const event = eventIn(state)

        expect(() => event.publish({ by: 2, at: NOW })).toThrow(new AppError('EVENT_NOT_DRAFT'))
        expect(event.state).toBe(state)
        expect(event.updatedAt).toBe(CREATED_AT)
        expect(event.updatedById).toBeNull()
      },
    )
  })
})
