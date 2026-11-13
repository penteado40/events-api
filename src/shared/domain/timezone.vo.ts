import { AppError } from './app-error.js'
import { LocalDate } from './local-date.vo.js'

/** An IANA name (`America/Manaus`, `UTC`); Intl also takes offsets (`-03:00`), which are not one. */
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/

/**
 * The IANA time zone of a place (`America/Manaus`). It labels and orders the
 * local dates and times of that place and tells what day it is there; it never
 * turns them into UTC (ADR-0016).
 */
export class Timezone {
  private constructor(
    readonly value: string,
    private readonly calendar: Intl.DateTimeFormat,
  ) {}

  /** From an IANA name, written back as IANA spells it; anything else is VALIDATION_ERROR. */
  static create(raw: string): Timezone {
    if (!IANA_NAME.test(raw)) throw new AppError('VALIDATION_ERROR')
    let calendar: Intl.DateTimeFormat
    try {
      calendar = new Intl.DateTimeFormat('en-US', {
        timeZone: raw,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      throw new AppError('VALIDATION_ERROR')
    }
    return new Timezone(calendar.resolvedOptions().timeZone, calendar)
  }

  /** The calendar date in this zone at that instant. */
  today(at: Date): LocalDate {
    const parts = this.calendar.formatToParts(at)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? ''
    return LocalDate.create(`${part('year')}-${part('month')}-${part('day')}`)
  }

  equals(other: Timezone): boolean {
    return this.value === other.value
  }
}
