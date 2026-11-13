import { AppError } from '../../../shared/domain/app-error.js'
import { LocalDate } from '../../../shared/domain/local-date.vo.js'
import { LocalTime } from '../../../shared/domain/local-time.vo.js'

/**
 * When an Event item starts, as the place tells it: a calendar date and a
 * time, both optional, the time only with a date. No date is an item of the
 * General info; a date with no time is the day free or the lunch with the time
 * to confirm. Never converted (ADR-0016); the zone is the place's.
 */
export class EventItemStart {
  private constructor(
    readonly date: LocalDate | null,
    readonly time: LocalTime | null,
  ) {}

  /** A time with no date is EVENT_ITEM_TIME_WITHOUT_DATE. */
  static of(date: LocalDate | null, time: LocalTime | null): EventItemStart {
    if (time !== null && date === null) throw new AppError('EVENT_ITEM_TIME_WITHOUT_DATE')
    return new EventItemStart(date, time)
  }

  equals(other: EventItemStart): boolean {
    return this.date?.value === other.date?.value && this.time?.value === other.time?.value
  }

  /** From `YYYY-MM-DD` and `HH:mm`, each optional; a bad date or time is VALIDATION_ERROR. */
  static create(raw: { date: string | null; time: string | null }): EventItemStart {
    return EventItemStart.of(
      raw.date === null ? null : LocalDate.create(raw.date),
      raw.time === null ? null : LocalTime.create(raw.time),
    )
  }
}
