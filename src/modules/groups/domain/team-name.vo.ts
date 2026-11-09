import { AppError } from '../../../shared/domain/app-error.js'

export const TEAM_NAME_MAX_LENGTH = 100

/** The name of a Team, trimmed, from 1 to 100 characters. */
export class TeamName {
  private constructor(readonly value: string) {}

  static create(raw: string): TeamName {
    const value = raw.trim()
    if (value.length === 0 || value.length > TEAM_NAME_MAX_LENGTH) {
      throw new AppError('VALIDATION_ERROR')
    }
    return new TeamName(value)
  }
}
