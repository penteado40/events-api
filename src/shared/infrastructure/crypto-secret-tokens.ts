import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { type GeneratedSecretToken, SecretTokens } from '../application/secret-tokens.js'

const SHA256_HEX = /^[0-9a-f]{64}$/

/** 32 random bytes in base64url after the prefix; SHA-256 in hex. */
export class CryptoSecretTokens extends SecretTokens {
  generate(prefix: string): GeneratedSecretToken {
    const value = `${prefix}${randomBytes(32).toString('base64url')}`
    return { value, hash: this.hash(value) }
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  matches(value: string | undefined, hash: string | undefined): boolean {
    if (!value || !hash || !SHA256_HEX.test(hash)) return false
    return timingSafeEqual(Buffer.from(this.hash(value), 'hex'), Buffer.from(hash, 'hex'))
  }
}
