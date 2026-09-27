import { PasswordHasher } from '../ports/password-hasher.js'

/** Reversible "hash" that keeps tests fast and readable. */
export class FakePasswordHasher extends PasswordHasher {
  readonly comparedHashes: (string | null)[] = []

  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`
  }

  async compare(plain: string, hash: string | null): Promise<boolean> {
    this.comparedHashes.push(hash)
    return hash === `hashed:${plain}`
  }
}
