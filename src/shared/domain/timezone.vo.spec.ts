import { describe, expect, it } from 'vitest'
import { AppError } from './app-error.js'
import { Timezone } from './timezone.vo.js'

describe('Timezone', () => {
  it('accepts an IANA time zone', () => {
    expect(Timezone.create('America/Manaus').value).toBe('America/Manaus')
    expect(Timezone.create('UTC').value).toBe('UTC')
  })

  it('keeps the zone exactly as written, never rewritten to another name', () => {
    expect(Timezone.create('America/Sao_Paulo').value).toBe('America/Sao_Paulo')
    expect(Timezone.create('Asia/Tokyo').value).toBe('Asia/Tokyo')
  })

  it.each([
    'Asia/Kolkata',
    'Europe/Kyiv',
    'America/Nuuk',
    'Asia/Ho_Chi_Minh',
    'Asia/Yangon',
    'Atlantic/Faroe',
    'Pacific/Kanton',
  ])('accepts the current IANA name %j, kept as sent even where Intl lists an older one', (raw) => {
    expect(Timezone.create(raw).value).toBe(raw)
  })

  it.each([
    'America/Atlantida',
    'GMT-3',
    '-03:00',
    '+05:30',
    'Manaus',
    '',
    // Abbreviations and legacy aliases Intl would resolve to another zone.
    'EST',
    'GMT',
    'Brazil/East',
    'US/Eastern',
    'Etc/GMT+3',
    // Another casing or spacing of a real zone.
    'america/sao_paulo',
    'AMERICA/MANAUS',
    'utc',
    'America/manaus',
    'Asia/kolkata',
    ' America/Manaus ',
  ])('refuses %j with VALIDATION_ERROR', (raw) => {
    expect(() => Timezone.create(raw)).toThrow(new AppError('VALIDATION_ERROR'))
  })

  it('tells the calendar date at an instant in the zone, not in UTC', () => {
    // 23:30 of the 12th in São Paulo and Manaus' 22:30; already the 13th in UTC and Tokyo.
    const at = new Date('2026-11-13T02:30:00.000Z')

    expect(Timezone.create('America/Sao_Paulo').today(at).value).toBe('2026-11-12')
    expect(Timezone.create('America/Manaus').today(at).value).toBe('2026-11-12')
    expect(Timezone.create('UTC').today(at).value).toBe('2026-11-13')
    expect(Timezone.create('Asia/Tokyo').today(at).value).toBe('2026-11-13')
  })

  it('is equal to another Timezone of the same zone', () => {
    expect(Timezone.create('America/Manaus').equals(Timezone.create('America/Manaus'))).toBe(true)
    expect(Timezone.create('America/Manaus').equals(Timezone.create('UTC'))).toBe(false)
  })
})
