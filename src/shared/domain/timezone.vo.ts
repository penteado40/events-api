import { AppError } from './app-error.js'
import { LocalDate } from './local-date.vo.js'

/**
 * The IANA names this runtime lists, spelled exactly as listed. Node's list
 * leaves `UTC` out.
 */
const LISTED_NAMES: ReadonlySet<string> = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC'])

/** The geographic areas of the listed names; `Brazil/`, `US/`, `Etc/`... are not among them. */
const AREAS: ReadonlySet<string> = new Set(
  Intl.supportedValuesOf('timeZone').map((name) => name.split('/')[0] ?? name),
)

/**
 * Whether `raw` is an IANA name, kept exactly as written. The ICU behind Intl
 * may list an older name (`Asia/Calcutta`) and know the current one
 * (`Asia/Kolkata`) only as its alias, so an alias in a geographic area, with
 * each part capitalized, is accepted too. Intl also takes offsets (`-03:00`),
 * abbreviations (`EST`), country-style aliases (`Brazil/East`) and any casing
 * of a name (`america/manaus`), all resolved to another name; none of those is
 * accepted, so a zone is never rewritten.
 */
function isIanaName(raw: string): boolean {
  if (LISTED_NAMES.has(raw)) return true
  const segments = raw.split('/')
  if (!AREAS.has(segments[0] ?? '') || !segments.every((s) => /^[A-Z]/.test(s))) return false
  const resolved = resolve(raw)
  // A case variant of the name it resolves to is not an alias.
  return resolved !== undefined && resolved.toLowerCase() !== raw.toLowerCase()
}

function resolve(raw: string): string | undefined {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: raw }).resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

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

  /** From an IANA name, kept exactly as written; anything else is VALIDATION_ERROR. */
  static create(raw: string): Timezone {
    if (!isIanaName(raw)) throw new AppError('VALIDATION_ERROR')
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
