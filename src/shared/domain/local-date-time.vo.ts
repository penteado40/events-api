import { LocalDate } from './local-date.vo.js'
import { LocalTime } from './local-time.vo.js'
import { Timezone } from './timezone.vo.js'

/**
 * When something happens, as the place where it happens tells it: a calendar
 * date, an optional time and the zone of the place. Nothing here is converted
 * to UTC (ADR-0016): "19:00 in Manaus" is 19:00 for everyone, and the zone only
 * labels it ("horário de Manaus") and orders it.
 */
export class LocalDateTime {
  private constructor(
    readonly date: LocalDate,
    /** null when only the day is known. */
    readonly time: LocalTime | null,
    readonly timezone: Timezone,
  ) {}

  static create(raw: { date: string; time: string | null; timezone: string }): LocalDateTime {
    return new LocalDateTime(
      LocalDate.create(raw.date),
      raw.time === null ? null : LocalTime.create(raw.time),
      Timezone.create(raw.timezone),
    )
  }
}
