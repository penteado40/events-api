import bcrypt from 'bcryptjs'
import { PasswordHasher } from '../application/ports/password-hasher.js'

/** Cost 10, compatible with the hashes migrated from fawedding-api. */
const COST = 10
/** bcrypt("timing-equalizer", 10): compared against when the User does not exist. */
const DUMMY_HASH = '$2b$10$Iklldu0YrOqwFb93nfkp3OEhG.X2Q85juONeAgt5DOJVqIryst/fK'

export class BcryptPasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST)
  }

  async compare(plain: string, hash: string | null): Promise<boolean> {
    const matches = await bcrypt.compare(plain, hash ?? DUMMY_HASH)
    return hash !== null && matches
  }
}
