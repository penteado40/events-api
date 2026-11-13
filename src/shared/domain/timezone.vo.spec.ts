import { describe, expect, it } from 'vitest'
import { AppError } from './app-error.js'
import { Timezone } from './timezone.vo.js'

describe('Timezone', () => {
  it('accepts an IANA time zone', () => {
    expect(Timezone.create('America/Manaus').value).toBe('America/Manaus')
    expect(Timezone.create('UTC').value).toBe('UTC')
  })

  it('writes the zone as IANA spells it, whatever the casing typed', () => {
    expect(Timezone.create('america/sao_paulo').value).toBe('America/Sao_Paulo')
  })

  it.each(['America/Atlantida', 'GMT-3', '-03:00', '+05:30', 'Manaus', ''])(
    'refuses %j with VALIDATION_ERROR',
    (raw) => {
      expect(() => Timezone.create(raw)).toThrow(new AppError('VALIDATION_ERROR'))
    },
  )

  it('tells the calendar date at an instant in the zone, not in UTC', () => {
    // 23:30 of the 12th in São Paulo and Manaus' 22:30; already the 13th in UTC and Tokyo.
    const at = new Date('2026-11-13T02:30:00.000Z')

    expect(Timezone.create('America/Sao_Paulo').today(at).value).toBe('2026-11-12')
    expect(Timezone.create('America/Manaus').today(at).value).toBe('2026-11-12')
    expect(Timezone.create('UTC').today(at).value).toBe('2026-11-13')
    expect(Timezone.create('Asia/Tokyo').today(at).value).toBe('2026-11-13')
  })

  it('is equal to another Timezone of the same zone', () => {
    expect(Timezone.create('America/Manaus').equals(Timezone.create('america/manaus'))).toBe(true)
    expect(Timezone.create('America/Manaus').equals(Timezone.create('UTC'))).toBe(false)
  })
})
