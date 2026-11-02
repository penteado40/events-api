import { AppError } from './app-error.js'

/** The separators people type in a phone number, dropped before validating. */
const SEPARATORS = /[\s().-]/g
/** E.164: `+`, the country code (never starting at 0) and up to 15 digits in all. */
const E164_REGEX = /^\+[1-9]\d{7,14}$/

/**
 * A phone number for contact only (e.g. opening WhatsApp), never for sign-in.
 * Always stored in E.164, with the country code: `+5511987654321`.
 */
export class Phone {
  private constructor(readonly value: string) {}

  static create(raw: string): Phone {
    const value = raw.replace(SEPARATORS, '')
    if (!E164_REGEX.test(value)) throw new AppError('VALIDATION_ERROR')
    return new Phone(value)
  }

  equals(other: Phone): boolean {
    return this.value === other.value
  }
}
