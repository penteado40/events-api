import type { Clock } from '../../../../shared/application/clock.js'
import { Email } from '../../../../shared/domain/email.vo.js'
import { Phone } from '../../../../shared/domain/phone.vo.js'
import type { User } from '../../domain/user.entity.js'
import type { UserRepository } from '../../domain/user.repository.js'

export interface CreateSuperAdminInput {
  email: string
  name: string
  /** Only for a User created now: an existing User keeps their phone. */
  phone: string
}

export interface CreateSuperAdminOutput {
  outcome: 'created' | 'promoted' | 'unchanged'
  user: User
}

/**
 * Idempotent: creates the User as Super admin, or promotes an existing one.
 * Only the local User: the person enters Clerk by an invitation to the same
 * email, and their first sign-in links it (ADR-0020). Runs from a platform
 * script, so its writes have no Author (ADR-0013).
 */
export class CreateSuperAdminUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateSuperAdminInput): Promise<CreateSuperAdminOutput> {
    const email = Email.create(input.email)
    const phone = Phone.create(input.phone)
    const existing = await this.users.findByEmail(email)
    const stamp = { by: null, at: this.clock.now() }

    if (!existing) {
      const user = await this.users.create(
        { name: input.name, email, phone, role: 'SUPER_ADMIN' },
        stamp,
      )
      return { outcome: 'created', user }
    }

    if (existing.isSuperAdmin) return { outcome: 'unchanged', user: existing }
    existing.promoteToSuperAdmin(stamp)
    await this.users.save(existing)
    return { outcome: 'promoted', user: existing }
  }
}
