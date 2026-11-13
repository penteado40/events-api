import { AppError } from '../../../shared/domain/app-error.js'

export const EVENT_NAME_MAX_LENGTH = 200

/** The name of an Event ("Show em Manaus"), trimmed, from 1 to 200 characters. */
export class EventName {
  private constructor(readonly value: string) {}

  static create(raw: string): EventName {
    const value = raw.trim()
    if (value.length === 0 || value.length > EVENT_NAME_MAX_LENGTH) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new EventName(value)
  }
}
