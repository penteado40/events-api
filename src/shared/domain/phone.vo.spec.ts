import { describe, expect, it } from 'vitest'
import { AppError } from './app-error.js'
import { Phone } from './phone.vo.js'

describe('Phone', () => {
  it.each([
    ['+5511987654321', '+5511987654321'],
    [' +55 (11) 98765-4321 ', '+5511987654321'],
    ['+1 415.555.2671', '+14155552671'],
  ])('stores %j as %j', (raw, value) => {
    expect(Phone.create(raw).value).toBe(value)
  })

  it.each([
    ['without the country code', '11987654321'],
    ['with letters', '+55 11 9876-ABCD'],
    ['too short', '+5511'],
    ['longer than E.164 allows', '+5511987654321123'],
    ['with a country code starting at 0', '+0511987654321'],
    ['empty', ''],
  ])('refuses a phone %s with VALIDATION_ERROR', (_, raw) => {
    expect(() => Phone.create(raw)).toThrow(new AppError('VALIDATION_ERROR'))
  })

  it('compares by the normalized value', () => {
    expect(Phone.create('+55 11 98765-4321').equals(Phone.create('+5511987654321'))).toBe(true)
  })
})
