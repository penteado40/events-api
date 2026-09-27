import { AppError } from '../../../../shared/domain/app-error.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'

export interface GetCurrentUserInput {
  userId: number
  /** JWT `iat`, in seconds. */
  issuedAt: number
}

/** Resolves the User behind a session token, refusing revoked sessions. */
export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<User> {
    const user = await this.users.findById(input.userId)
    if (!user || user.isSessionRevoked(input.issuedAt)) throw new AppError('UNAUTHENTICATED')
    return user
  }
}
