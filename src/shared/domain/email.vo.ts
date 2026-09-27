import { AppError } from './app-error.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** An email address, always trimmed and lower-cased. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase()
    if (!EMAIL_REGEX.test(value)) throw new AppError('VALIDATION_ERROR')
    return new Email(value)
  }

  equals(other: Email): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
