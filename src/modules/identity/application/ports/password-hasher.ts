export abstract class PasswordHasher {
  abstract hash(plain: string): Promise<string>
  /**
   * With `hash = null` (unknown User) it still spends the time of a real
   * comparison and returns false, so login timing does not reveal which
   * emails exist.
   */
  abstract compare(plain: string, hash: string | null): Promise<boolean>
}
