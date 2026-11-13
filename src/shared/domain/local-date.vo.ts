import { AppError } from './app-error.js'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A calendar date (`2026-11-14`), with no time and no time zone of its own. It
 * is the date where something happens and is never converted to UTC
 * (ADR-0016): the zone that gives it meaning travels beside it.
 */
export class LocalDate {
  private constructor(readonly value: string) {}

  /** From `YYYY-MM-DD`; a date the calendar does not have (`2026-02-29`) is VALIDATION_ERROR. */
  static create(raw: string): LocalDate {
    const match = ISO_DATE.exec(raw)
    if (!match) throw new AppError('VALIDATION_ERROR')
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    // A day past the end of the month rolls Date.UTC into the next one.
    const probe = new Date(Date.UTC(year, month - 1, day))
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new LocalDate(raw)
  }

  /** Whether this day comes before the other on the calendar. */
  isBefore(other: LocalDate): boolean {
    // Four-digit years, zero-padded: the text orders like the calendar.
    return this.value < other.value
  }

  equals(other: LocalDate): boolean {
    return this.value === other.value
  }
}
