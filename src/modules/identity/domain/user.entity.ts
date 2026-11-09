import { AppError } from '../../../shared/domain/app-error.js'
import type { Email } from '../../../shared/domain/email.vo.js'
import type { Phone } from '../../../shared/domain/phone.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'

export const ROLES = ['SUPER_ADMIN', 'USER'] as const
export type Role = (typeof ROLES)[number]

export interface UserProps {
  id: number
  name: string
  email: Email
  /** Contact only (e.g. WhatsApp), never sign-in nor identification. */
  phone: Phone
  /** The Clerk user this User signs in as (ADR-0020); null while a Pending user. */
  clerkId: string | null
  role: Role
  /** When the User became a Deactivated user; set by the database or a script for now (PROJ-99). */
  deactivatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

export interface NewUserProps {
  name: string
  email: Email
  phone: Phone
  role: Role
}

/**
 * A person with a login on the platform, whose identity lives in Clerk
 * (ADR-0020). Born a Pending user, and active once their first sign-in links
 * the Clerk user.
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
  get phone(): Phone {
    return this.props.phone
  }
  get clerkId(): string | null {
    return this.props.clerkId
  }
  get role(): Role {
    return this.props.role
  }
  get deactivatedAt(): Date | null {
    return this.props.deactivatedAt
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

  /** Already signs in as a Clerk user, so no other one can take it over. */
  get isLinkedToClerk(): boolean {
    return this.props.clerkId !== null
  }

  get isSuperAdmin(): boolean {
    return this.props.role === 'SUPER_ADMIN'
  }

  /** Retired from the platform: refused on every request, even with a valid Clerk session. */
  get isDeactivated(): boolean {
    return this.props.deactivatedAt !== null
  }

  /** Has not signed in yet: no Clerk user is linked. */
  get isPending(): boolean {
    return !this.isLinkedToClerk
  }

  /** The User edits their own name and phone; the email comes from Clerk and stays. */
  editProfile(changes: { name?: string; phone?: Phone }, stamp: Stamp): void {
    if (changes.name !== undefined) this.props.name = changes.name.trim()
    if (changes.phone !== undefined) this.props.phone = changes.phone
    this.touch(stamp)
  }

  /**
   * Mirrors the name and email the person changed in Clerk (ADR-0020). Leaves
   * out what is missing, and answers whether anything changed: an unchanged
   * User keeps its authorship.
   */
  mirrorProfile(changes: { name?: string; email?: Email }, stamp: Stamp): boolean {
    const name = changes.name?.trim()
    const newName = name !== undefined && name !== '' && name !== this.props.name
    const newEmail = changes.email !== undefined && !changes.email.equals(this.props.email)
    if (!newName && !newEmail) return false
    if (newName) this.props.name = name
    if (newEmail) this.props.email = changes.email!
    this.touch(stamp)
    return true
  }

  promoteToSuperAdmin(stamp: Stamp): void {
    this.props.role = 'SUPER_ADMIN'
    this.touch(stamp)
  }

  /**
   * The first sign-in with the invited email links the Clerk user, once: a
   * User already linked to another Clerk user is never taken over.
   */
  linkToClerk(clerkId: string, stamp: Stamp): void {
    if (this.isLinkedToClerk) throw new AppError('UNAUTHENTICATED')
    this.props.clerkId = clerkId
    this.touch(stamp)
  }

  private touch(stamp: Stamp): void {
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}
