import { AppError } from '../../../shared/domain/app-error.js'

export const EVENT_PLACE_MAX_LENGTH = 200

/**
 * Where an Event happens, as free text: a city or a venue ("Manaus - AM",
 * "Teatro Amazonas"), trimmed, from 1 to 200 characters. Its default zone lives
 * in the EventPeriod.
 */
export class EventPlace {
  private constructor(readonly value: string) {}

  static create(raw: string): EventPlace {
    const value = raw.trim()
    if (value.length === 0 || value.length > EVENT_PLACE_MAX_LENGTH) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new EventPlace(value)
  }
}
