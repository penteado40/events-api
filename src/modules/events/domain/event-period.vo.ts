import { AppError } from '../../../shared/domain/app-error.js'
import { LocalDate } from '../../../shared/domain/local-date.vo.js'
import { Timezone } from '../../../shared/domain/timezone.vo.js'

/** A period as it travels: `{ startDate, endDate, timezone }`, with no conversion. */
export interface EventPeriodValues {
  startDate: string
  endDate: string
  timezone: string
}

/**
 * When an Event happens: its first and last calendar days, with no time, and
 * the default zone of the place where it happens. The dates are never converted
 * to UTC (ADR-0016).
 */
export class EventPeriod {
  private constructor(
    readonly startDate: LocalDate,
    readonly endDate: LocalDate,
    readonly timezone: Timezone,
  ) {}

  /** An end date before the start date is EVENT_PERIOD_INVALID; a bad date or zone, VALIDATION_ERROR. */
  static create(raw: EventPeriodValues): EventPeriod {
    const startDate = LocalDate.create(raw.startDate)
    const endDate = LocalDate.create(raw.endDate)
    const timezone = Timezone.create(raw.timezone)
    if (endDate.isBefore(startDate)) throw new AppError('EVENT_PERIOD_INVALID')
    return new EventPeriod(startDate, endDate, timezone)
  }

  /** The period as it travels, with no conversion. */
  toValues(): EventPeriodValues {
    return {
      startDate: this.startDate.value,
      endDate: this.endDate.value,
      timezone: this.timezone.value,
    }
  }

  /** Whether both periods have the same dates and the same zone. */
  equals(other: EventPeriod): boolean {
    return (
      this.startDate.value === other.startDate.value &&
      this.endDate.value === other.endDate.value &&
      this.timezone.value === other.timezone.value
    )
  }

  /** Whether, at that instant, the zone of the Event is already past the end date. */
  hasEnded(at: Date): boolean {
    return this.endDate.isBefore(this.timezone.today(at))
  }
}
