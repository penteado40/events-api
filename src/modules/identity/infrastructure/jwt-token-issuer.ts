import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { type IssuedToken, TokenIssuer } from '../application/ports/token-issuer.js'
import type { User } from '../domain/user.entity.js'

/** 12h, no refresh token. */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60

/** JWT payload: only `sub` plus the standard `iat`/`exp`. */
export interface SessionTokenPayload {
  sub: string
  iat: number
  exp: number
}

@Injectable()
export class JwtTokenIssuer extends TokenIssuer {
  constructor(private readonly jwt: JwtService) {
    super()
  }

  async issue(user: User): Promise<IssuedToken> {
    const token = await this.jwt.signAsync({ sub: String(user.id) })
    return { token, expiresIn: TOKEN_TTL_SECONDS }
  }
}
