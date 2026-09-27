import type { Email } from '../../../shared/domain/email.vo.js'

export const ROLES = ['SUPER_ADMIN', 'USER'] as const
export type Role = (typeof ROLES)[number]

export interface UserProps {
  id: number
  name: string
  email: Email
  passwordHash: string
  role: Role
  passwordChangedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NewUserProps {
  name: string
  email: Email
  passwordHash: string
  role: Role
}

/** A person with a login on the platform. Only the Super admin creates Users. */
export class User {
  private constructor(private readonly props: UserProps) {}

  static restore(props: UserProps): User {
    return new User({ ...props })
  }

  get id(): number {
    return this.props.id
  }
  get name(): string {
    return this.props.name
  }
  get email(): Email {
    return this.props.email
  }
  get passwordHash(): string {
    return this.props.passwordHash
  }
  get role(): Role {
    return this.props.role
  }
  get passwordChangedAt(): Date | null {
    return this.props.passwordChangedAt
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  get isSuperAdmin(): boolean {
    return this.props.role === 'SUPER_ADMIN'
  }

  promoteToSuperAdmin(): void {
    this.props.role = 'SUPER_ADMIN'
  }

  changePassword(passwordHash: string, at: Date = new Date()): void {
    this.props.passwordHash = passwordHash
    this.props.passwordChangedAt = at
  }

  /**
   * A session issued before the last password change is revoked. JWT `iat` has
   * second precision, so the change time is truncated to the second as well.
   */
  isSessionRevoked(issuedAtSeconds: number): boolean {
    if (!this.props.passwordChangedAt) return false
    return issuedAtSeconds < Math.floor(this.props.passwordChangedAt.getTime() / 1000)
  }
}
