export interface GeneratedSecretToken {
  /** Shown once to whoever asked for it; never stored. */
  value: string
  hash: string
}

/**
 * Random secrets that are stored only as a hash (API tokens, Contribution
 * tokens). The hash is the SHA-256 of the whole value, as in the fawedding-api,
 * so migrated tokens keep working.
 */
export abstract class SecretTokens {
  /** The prefix makes a leaked value recognizable (in logs, by secret scanners). */
  abstract generate(prefix: string): GeneratedSecretToken
  abstract hash(value: string): string
  /** Constant-time; an empty or missing value or hash never matches. */
  abstract matches(value: string | undefined, hash: string | undefined): boolean
}
