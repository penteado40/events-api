import { AppError } from '../../../shared/domain/app-error.js'

/** kebab-case ASCII: lowercase letters and digits, single hyphens between them. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 60

/** The readable, permanent identifier of an Event, unique on the platform. */
export class Slug {
  private constructor(readonly value: string) {}

  static create(value: string): Slug {
    if (
      value.length < SLUG_MIN_LENGTH ||
      value.length > SLUG_MAX_LENGTH ||
      !SLUG_PATTERN.test(value)
    ) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new Slug(value)
  }

  /** A value already stored, trusted as is: the rule guards input, not reads. */
  static restore(value: string): Slug {
    return new Slug(value)
  }

  equals(other: Slug): boolean {
    return this.value === other.value
  }
}
