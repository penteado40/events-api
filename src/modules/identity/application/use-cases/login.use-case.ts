import { AppError } from '../../../../shared/domain/app-error.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'
import type { PasswordHasher } from '../ports/password-hasher.js'
import type { TokenIssuer } from '../ports/token-issuer.js'

export interface LoginInput {
  email: string
  password: string
}

export interface LoginOutput {
  token: string
  expiresIn: number
  user: User
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const email = parseEmail(input.email)
    const user = email ? await this.users.findByEmail(email) : null
    // Accepted trade-off: this reveals that the email belongs to a Pending user.
    if (user?.isPending) throw new AppError('USER_PENDING')
    // Unknown email still pays for a comparison (constant time).
    const valid = await this.hasher.compare(input.password, user?.passwordHash ?? null)
    if (!user || !valid) throw new AppError('INVALID_CREDENTIALS')
    const { token, expiresIn } = await this.tokens.issue(user)
    return { token, expiresIn, user }
  }
}

function parseEmail(raw: string): Email | null {
  try {
    return Email.create(raw)
  } catch (error) {
    if (error instanceof AppError) return null
    throw error
  }
}
