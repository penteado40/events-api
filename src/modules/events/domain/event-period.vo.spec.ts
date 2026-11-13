import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { EventPeriod } from './event-period.vo.js'

describe('EventPeriod', () => {
  it('keeps the start and end dates and the zone of the place as written', () => {
    const period = EventPeriod.create({
      startDate: '2026-11-13',
      endDate: '2026-11-16',
      timezone: 'America/Manaus',
    })

    expect(period.startDate.value).toBe('2026-11-13')
    expect(period.endDate.value).toBe('2026-11-16')
    expect(period.timezone.value).toBe('America/Manaus')
  })

  it('goes back to the values it travels as, unchanged', () => {
    const values = { startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'America/Manaus' }

    expect(EventPeriod.create(values).toValues()).toEqual(values)
  })

  it('may start and end on the same day (a rehearsal of an afternoon)', () => {
    const period = EventPeriod.create({
      startDate: '2026-11-13',
      endDate: '2026-11-13',
      timezone: 'America/Sao_Paulo',
    })

    expect(period.endDate.value).toBe('2026-11-13')
  })

  it('refuses an end date before the start date with EVENT_PERIOD_INVALID', () => {
    expect(() =>
      EventPeriod.create({
        startDate: '2026-11-16',
        endDate: '2026-11-13',
        timezone: 'America/Manaus',
      }),
    ).toThrow(new AppError('EVENT_PERIOD_INVALID'))
  })

  it('refuses a date or a zone that is not valid with VALIDATION_ERROR', () => {
    expect(() =>
      EventPeriod.create({ startDate: '2026-02-30', endDate: '2026-03-01', timezone: 'UTC' }),
    ).toThrow(new AppError('VALIDATION_ERROR'))
    expect(() =>
      EventPeriod.create({ startDate: '2026-11-13', endDate: '2026-11-16', timezone: 'Manaus' }),
    ).toThrow(new AppError('VALIDATION_ERROR'))
  })

  describe('hasEnded', () => {
    const manaus = EventPeriod.create({
      startDate: '2026-11-13',
      endDate: '2026-11-16',
      timezone: 'America/Manaus',
    })

    it('is false on the last day, up to its last minute in the zone of the Event', () => {
      // 23:59 of the 16th in Manaus (UTC-4) is already the 17th in UTC.
      expect(manaus.hasEnded(new Date('2026-11-17T03:59:00.000Z'))).toBe(false)
    })

    it('is true once the zone of the Event is past the end date', () => {
      // 00:00 of the 17th in Manaus.
      expect(manaus.hasEnded(new Date('2026-11-17T04:00:00.000Z'))).toBe(true)
    })

    it('is false before and during the period', () => {
      expect(manaus.hasEnded(new Date('2026-11-01T12:00:00.000Z'))).toBe(false)
      expect(manaus.hasEnded(new Date('2026-11-14T12:00:00.000Z'))).toBe(false)
    })
  })
})
