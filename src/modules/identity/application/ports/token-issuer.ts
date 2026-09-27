import type { User } from '../../domain/user.entity.js'

export interface IssuedToken {
  token: string
  /** Lifetime in seconds. */
  expiresIn: number
}

export abstract class TokenIssuer {
  abstract issue(user: User): Promise<IssuedToken>
}
