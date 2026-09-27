/** Rules a User password must follow. */
export const PasswordPolicy = {
  /** Minimum length of a strong password (required for the Super admin in production). */
  STRONG_MIN_LENGTH: 12,

  isStrong(plain: string): boolean {
    return plain.length >= PasswordPolicy.STRONG_MIN_LENGTH
  },
}
