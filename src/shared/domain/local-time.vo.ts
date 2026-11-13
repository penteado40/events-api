import { AppError } from './app-error.js'

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

/** A wall-clock time of day (`19:00`), with no date and no zone of its own; never converted (ADR-0016). */
export class LocalTime {
  private constructor(readonly value: string) {}

  /** From `HH:mm`, 00:00 to 23:59; anything else is VALIDATION_ERROR. */
  static create(raw: string): LocalTime {
    if (!HH_MM.test(raw)) throw new AppError('VALIDATION_ERROR')
    return new LocalTime(raw)
  }

  equals(other: LocalTime): boolean {
    return this.value === other.value
  }
}
