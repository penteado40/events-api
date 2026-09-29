import { AppError } from '../../../shared/domain/app-error.js'
import type { Email } from '../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'

export const ROLES = ['SUPER_ADMIN', 'USER'] as const
export type Role = (typeof ROLES)[number]

export interface UserProps {
  id: number
  name: string
  email: Email
  /** Null while the User is a Pending user. */
  passwordHash: string | null
  role: Role
  passwordChangedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewUserProps {
  name: string
  email: Email
  passwordHash: string | null
  role: Role
}

/**
 * A person with a login on the platform. Born a Pending user (no password)
 * and activated through an Activation link; nobody else sets their password.
 */
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
  get passwordHash(): string | null {
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
  get createdById(): number | null {
    return this.props.createdById
  }
  get updatedById(): number | null {
    return this.props.updatedById
  }

  get isSuperAdmin(): boolean {
    return this.props.role === 'SUPER_ADMIN'
  }

  /** Has not set a password yet, so cannot log in. */
  get isPending(): boolean {
    return this.props.passwordHash === null
  }

  promoteToSuperAdmin(stamp: Stamp): void {
    this.props.role = 'SUPER_ADMIN'
    this.touch(stamp)
  }

  /** A Pending user sets their own first password; only a Pending user can. */
  activate(passwordHash: string, stamp: Stamp): void {
    if (!this.isPending) throw new AppError('USER_ALREADY_ACTIVE')
    this.changePassword(passwordHash, stamp)
  }

  changePassword(passwordHash: string, stamp: Stamp): void {
    this.props.passwordHash = passwordHash
    this.props.passwordChangedAt = stamp.at
    this.touch(stamp)
  }

  private touch(stamp: Stamp): void {
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
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
