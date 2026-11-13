import { describe, expect, it } from 'vitest'
import { AppError } from './app-error.js'
import { LocalDateTime } from './local-date-time.vo.js'

describe('LocalDateTime', () => {
  it('keeps the date, the time and the zone of the place as written, never in UTC', () => {
    const show = LocalDateTime.create({
      date: '2026-11-14',
      time: '19:00',
      timezone: 'America/Manaus',
    })

    expect(show.date.value).toBe('2026-11-14')
    expect(show.time?.value).toBe('19:00')
    expect(show.timezone.value).toBe('America/Manaus')
  })

  it('may have no time (the lunch with the time to confirm)', () => {
    const lunch = LocalDateTime.create({ date: '2026-11-14', time: null, timezone: 'UTC' })

    expect(lunch.time).toBeNull()
  })

  it.each(['24:00', '7:00', '19:60', '19:00:00', '19h'])(
    'refuses the time %j with VALIDATION_ERROR',
    (time) => {
      expect(() =>
        LocalDateTime.create({ date: '2026-11-14', time, timezone: 'America/Manaus' }),
      ).toThrow(new AppError('VALIDATION_ERROR'))
    },
  )

  it('refuses a date the calendar does not have, or a zone that is not IANA', () => {
    expect(() =>
      LocalDateTime.create({ date: '2026-02-30', time: null, timezone: 'America/Manaus' }),
    ).toThrow(new AppError('VALIDATION_ERROR'))
    expect(() =>
      LocalDateTime.create({ date: '2026-11-14', time: '19:00', timezone: '-04:00' }),
    ).toThrow(new AppError('VALIDATION_ERROR'))
  })
})
