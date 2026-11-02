import { AppError } from '../../../shared/domain/app-error.js'

export const GROUP_NAME_MAX_LENGTH = 100

/** The name of a Group, trimmed, from 1 to 100 characters. */
export class GroupName {
  private constructor(readonly value: string) {}

  static create(raw: string): GroupName {
    const value = raw.trim()
    if (value.length === 0 || value.length > GROUP_NAME_MAX_LENGTH) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new GroupName(value)
  }
}
