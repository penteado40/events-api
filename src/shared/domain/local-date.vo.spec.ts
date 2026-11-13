import { describe, expect, it } from 'vitest'
import { AppError } from './app-error.js'
import { LocalDate } from './local-date.vo.js'

describe('LocalDate', () => {
  it('keeps a calendar date as written, with no time and no conversion', () => {
    expect(LocalDate.create('2026-11-14').value).toBe('2026-11-14')
  })

  it('accepts the 29th of February of a leap year', () => {
    expect(LocalDate.create('2028-02-29').value).toBe('2028-02-29')
  })

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-04-31',
    '2026-00-10',
    '14/11/2026',
    '2026-11-14T10:00',
    '',
  ])('refuses %j with VALIDATION_ERROR', (raw) => {
    expect(() => LocalDate.create(raw)).toThrow(new AppError('VALIDATION_ERROR'))
  })

  it('orders dates by the calendar', () => {
    const friday = LocalDate.create('2026-11-13')
    const saturday = LocalDate.create('2026-11-14')

    expect(friday.isBefore(saturday)).toBe(true)
    expect(saturday.isBefore(friday)).toBe(false)
    expect(saturday.isBefore(LocalDate.create('2026-11-14'))).toBe(false)
    expect(LocalDate.create('2026-12-31').isBefore(LocalDate.create('2027-01-01'))).toBe(true)
  })

  it('is equal to another LocalDate of the same day', () => {
    expect(LocalDate.create('2026-11-14').equals(LocalDate.create('2026-11-14'))).toBe(true)
    expect(LocalDate.create('2026-11-14').equals(LocalDate.create('2026-11-15'))).toBe(false)
  })
})
