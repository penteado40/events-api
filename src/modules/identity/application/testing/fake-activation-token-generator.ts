import {
  ActivationTokenGenerator,
  type GeneratedActivationToken,
} from '../ports/activation-token-generator.js'

/** Predictable tokens (`token-1`, `token-2`...) with a readable "hash". */
export class FakeActivationTokenGenerator extends ActivationTokenGenerator {
  private sequence = 0

  generate(): GeneratedActivationToken {
    this.sequence += 1
    const token = `token-${this.sequence}`
    return { token, tokenHash: this.hash(token) }
  }

  hash(token: string): string {
    return `hash:${token}`
  }
}
