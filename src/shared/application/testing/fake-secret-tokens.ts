import { type GeneratedSecretToken, SecretTokens } from '../secret-tokens.js'

/** Predictable values (`<prefix>secret-1`, `<prefix>secret-2`...) with a readable "hash". */
export class FakeSecretTokens extends SecretTokens {
  private sequence = 0

  generate(prefix: string): GeneratedSecretToken {
    this.sequence += 1
    const value = `${prefix}secret-${this.sequence}`
    return { value, hash: this.hash(value) }
  }

  hash(value: string): string {
    return `hash:${value}`
  }

  matches(value: string | undefined, hash: string | undefined): boolean {
    return !!value && !!hash && this.hash(value) === hash
  }
}
