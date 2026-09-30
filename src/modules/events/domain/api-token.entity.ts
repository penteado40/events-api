import { AppError } from '../../../shared/domain/app-error.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { Scope } from './scope.js'

/** How stale `lastUsedAt` may get before a use is stored again. */
export const LAST_USED_WINDOW_MS = 60 * 60 * 1000

export interface NewApiTokenProps {
  eventId: number
  name: string
  tokenHash: string
  scopes: Scope[]
}

export interface ApiTokenProps extends NewApiTokenProps {
  id: number
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdById: number | null
  updatedById: number | null
}

/**
 * The Site's credential for one Event. Only the hash of its value is kept; the
 * value is shown once, when the token is created.
 */
export class ApiToken {
  private constructor(private readonly props: ApiTokenProps) {}

  static restore(props: ApiTokenProps): ApiToken {
    return new ApiToken({ ...props, scopes: [...props.scopes] })
  }

  /** Trims the name; throws VALIDATION_ERROR when the props break the rules. */
  static normalizeNew(props: NewApiTokenProps): NewApiTokenProps {
    const normalized = { ...props, name: normalizeName(props.name) }
    assertValidScopes(normalized.scopes)
    return normalized
  }

  get id(): number {
    return this.props.id
  }
  get eventId(): number {
    return this.props.eventId
  }
  get name(): string {
    return this.props.name
  }
  get tokenHash(): string {
    return this.props.tokenHash
  }
  get scopes(): Scope[] {
    return [...this.props.scopes]
  }
  get isActive(): boolean {
    return this.props.isActive
  }
  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt
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

  rename(name: string, stamp: Stamp): void {
    this.props.name = normalizeName(name)
    this.touch(stamp)
  }

  changeScopes(scopes: Scope[], stamp: Stamp): void {
    assertValidScopes(scopes)
    this.props.scopes = [...scopes]
    this.touch(stamp)
  }

  activate(stamp: Stamp): void {
    this.props.isActive = true
    this.touch(stamp)
  }

  deactivate(stamp: Stamp): void {
    this.props.isActive = false
    this.touch(stamp)
  }

  /**
   * Notes a use by the Site. Returns false while the last one stored is within
   * the window (nothing to store). A use is not an edit: no Author, no updatedAt.
   */
  recordUse(at: Date): boolean {
    const last = this.props.lastUsedAt
    if (last && at.getTime() - last.getTime() < LAST_USED_WINDOW_MS) return false
    this.props.lastUsedAt = at
    return true
  }

  private touch(stamp: Stamp): void {
    this.props.updatedAt = stamp.at
    this.props.updatedById = stamp.by
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new AppError('VALIDATION_ERROR')
  return trimmed
}

function assertValidScopes(scopes: Scope[]): void {
  if (scopes.length === 0 || new Set(scopes).size !== scopes.length) {
    throw new AppError('VALIDATION_ERROR')
  }
}
