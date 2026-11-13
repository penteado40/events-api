import { AppError } from '../../../shared/domain/app-error.js'
import { Timezone } from '../../../shared/domain/timezone.vo.js'

export const EVENT_ITEM_PLACE_NAME_MAX_LENGTH = 200
export const EVENT_ITEM_PLACE_ADDRESS_MAX_LENGTH = 500

/** A place as it travels and is stored: each part optional, the zone an IANA name. */
export interface EventItemPlaceValues {
  name: string | null
  address: string | null
  timezone: string | null
}

/** A place as it comes in: each part optional or null, not all missing. */
export type EventItemPlaceInput = Partial<EventItemPlaceValues>

/**
 * Where an Event item happens: a name ("Teatro Amazonas"), an address and the
 * zone of the place, each optional but not all missing. Without a zone, the
 * Event's default zone applies, read when the item is read, so it follows an
 * edit of the Event.
 */
export class EventItemPlace {
  private constructor(
    readonly name: string | null,
    readonly address: string | null,
    readonly timezone: Timezone | null,
  ) {}

  /** Blank parts count as missing; a place with no part, a part too long or a bad zone is VALIDATION_ERROR. */
  static create(raw: EventItemPlaceInput): EventItemPlace {
    const name = trimmedOrNull(raw.name, EVENT_ITEM_PLACE_NAME_MAX_LENGTH)
    const address = trimmedOrNull(raw.address, EVENT_ITEM_PLACE_ADDRESS_MAX_LENGTH)
    const timezone = raw.timezone == null ? null : Timezone.create(raw.timezone)
    if (name === null && address === null && timezone === null) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new EventItemPlace(name, address, timezone)
  }

  toValues(): EventItemPlaceValues {
    return { name: this.name, address: this.address, timezone: this.timezone?.value ?? null }
  }

  equals(other: EventItemPlace): boolean {
    return (
      this.name === other.name &&
      this.address === other.address &&
      this.timezone?.value === other.timezone?.value
    )
  }
}

function trimmedOrNull(raw: string | null | undefined, max: number): string | null {
  if (raw == null) return null
  const value = raw.trim()
  if (value.length > max) throw new AppError('VALIDATION_ERROR')
  return value.length === 0 ? null : value
}
