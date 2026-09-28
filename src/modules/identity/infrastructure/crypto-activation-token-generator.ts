import { createHash, randomBytes } from 'node:crypto'
import {
  ActivationTokenGenerator,
  type GeneratedActivationToken,
} from '../application/ports/activation-token-generator.js'

/** 32 random bytes (base64url); only the SHA-256 is stored. */
export class CryptoActivationTokenGenerator extends ActivationTokenGenerator {
  generate(): GeneratedActivationToken {
    const token = randomBytes(32).toString('base64url')
    return { token, tokenHash: this.hash(token) }
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
