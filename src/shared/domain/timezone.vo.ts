import { AppError } from './app-error.js'
import { LocalDate } from './local-date.vo.js'

/**
 * The canonical IANA names this runtime knows, spelled exactly as listed. Intl
 * also takes offsets (`-03:00`), abbreviations (`EST`), legacy aliases
 * (`Brazil/East`) and any casing, and resolves them to another name; none of
 * those is accepted, so a zone is never rewritten. Node's list leaves `UTC` out.
 */
const IANA_NAMES: ReadonlySet<string> = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC'])

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

  /** From a canonical IANA name, kept exactly as written; anything else is VALIDATION_ERROR. */
  static create(raw: string): Timezone {
    if (!IANA_NAMES.has(raw)) throw new AppError('VALIDATION_ERROR')
    const calendar = new Intl.DateTimeFormat('en-US', {
      timeZone: raw,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return new Timezone(raw, calendar)
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
