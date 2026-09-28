/** Rules every User password follows (no composition rules, NIST 800-63B). */
export const PasswordPolicy = {
  MIN_LENGTH: 12,
  /** bcrypt ignores everything past 72 bytes. */
  MAX_BYTES: 72,

  isStrong(plain: string): boolean {
    return (
      plain.length >= PasswordPolicy.MIN_LENGTH &&
      new TextEncoder().encode(plain).length <= PasswordPolicy.MAX_BYTES
    )
  },
}
