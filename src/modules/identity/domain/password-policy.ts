/**
 * Rules every User password follows (ADR-0012). Only ASCII characters count
 * toward the requirements; anything else is allowed but meets none of them.
 */
export const PasswordPolicy = {
  MIN_LENGTH: 8,
  /** bcrypt ignores everything past 72 bytes. */
  MAX_BYTES: 72,
  /** Uppercase, lowercase, digit and ASCII punctuation (no space). */
  REQUIRED: [/[A-Z]/, /[a-z]/, /[0-9]/, /[!-/:-@[-`{-~]/],

  isStrong(plain: string): boolean {
    return (
      [...plain].length >= PasswordPolicy.MIN_LENGTH &&
      new TextEncoder().encode(plain).length <= PasswordPolicy.MAX_BYTES &&
      PasswordPolicy.REQUIRED.every((pattern) => pattern.test(plain))
    )
  },
}
