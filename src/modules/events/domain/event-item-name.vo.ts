import { AppError } from '../../../shared/domain/app-error.js'

export const EVENT_ITEM_NAME_MAX_LENGTH = 200

/** The name of an Event item ("Passagem de som", "O que levar"), trimmed, from 1 to 200 characters. */
export class EventItemName {
  private constructor(readonly value: string) {}

  static create(raw: string): EventItemName {
    const value = raw.trim()
    if (value.length === 0 || value.length > EVENT_ITEM_NAME_MAX_LENGTH) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new EventItemName(value)
  }
}
