import type { User } from '../../domain/user.entity.js'
import { type IssuedToken, TokenIssuer } from '../ports/token-issuer.js'

export class FakeTokenIssuer extends TokenIssuer {
  async issue(user: User): Promise<IssuedToken> {
    return { token: `token-for-${user.id}`, expiresIn: 43_200 }
  }
}
