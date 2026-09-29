import { AppError } from '../../../shared/domain/app-error.js'
import type { SiteUrl } from './site-url.vo.js'
import type { Slug } from './slug.vo.js'

export const EVENT_TYPES = [
  'WEDDING',
  'BIRTHDAY',
  'CORPORATE',
  'BABY_SHOWER',
  'PARTY',
  'OTHER',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

/** Only what the platform can deliver today: email texts in pt-BR, Pix in BRL. */
export const LOCALES = ['pt-BR'] as const
export type Locale = (typeof LOCALES)[number]
export const CURRENCIES = ['BRL'] as const
export type Currency = (typeof CURRENCIES)[number]

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

/** What Owners and Managers edit about the happening itself. */
export interface EventDetails {
  type: EventType
  name: string
  startsAt: Date
  endsAt: Date | null
  timezone: string
  locale: Locale
  venueName: string | null
  venueAddress: string | null
  city: string | null
  mapsUrl: string | null
}

export interface NewEventProps extends EventDetails {
  slug: Slug
  siteUrl: SiteUrl
  currency: Currency
}

export interface EventProps extends NewEventProps {
  id: number
  status: EventStatus
  createdAt: Date
  updatedAt: Date
}

export type EventChanges = Partial<EventDetails> & { siteUrl?: SiteUrl }

/**
 * The tenant unit: a happening with its own Site. The slug and the currency
 * never change; the status changes only through archive/unarchive (ADR-0011).
 */
export class Event {
  private constructor(private readonly props: EventProps) {}

  static restore(props: EventProps): Event {
    return new Event({ ...props })
  }

  /** Throws VALIDATION_ERROR when the props of a new Event break its rules. */
  static assertValidNew(props: NewEventProps): void {
    validateDetails(props)
  }

  get id(): number {
    return this.props.id
  }
  get type(): EventType {
    return this.props.type
  }
  get status(): EventStatus {
    return this.props.status
  }
  get name(): string {
    return this.props.name
  }
  get slug(): Slug {
    return this.props.slug
  }
  get siteUrl(): SiteUrl {
    return this.props.siteUrl
  }
  get startsAt(): Date {
    return this.props.startsAt
  }
  get endsAt(): Date | null {
    return this.props.endsAt
  }
  get timezone(): string {
    return this.props.timezone
  }
  get locale(): Locale {
    return this.props.locale
  }
  get currency(): Currency {
    return this.props.currency
  }
  get venueName(): string | null {
    return this.props.venueName
  }
  get venueAddress(): string | null {
    return this.props.venueAddress
  }
  get city(): string | null {
    return this.props.city
  }
  get mapsUrl(): string | null {
    return this.props.mapsUrl
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
  get updatedAt(): Date {
    return this.props.updatedAt
  }

  /** Applies the changes only if the resulting Event is still valid. */
  update(changes: EventChanges, at: Date = new Date()): void {
    const next = { ...this.props, ...withoutUndefined(changes), updatedAt: at }
    validateDetails(next)
    Object.assign(this.props, next)
  }

  /** Returns false when the Event was already archived (nothing to store). */
  archive(): boolean {
    return this.changeStatus('ARCHIVED')
  }

  /** Returns false when the Event was already active (nothing to store). */
  unarchive(): boolean {
    return this.changeStatus('ACTIVE')
  }

  private changeStatus(status: EventStatus): boolean {
    if (this.props.status === status) return false
    this.props.status = status
    this.props.updatedAt = new Date()
    return true
  }
}

function validateDetails(details: EventDetails): void {
  if (details.endsAt && details.endsAt.getTime() <= details.startsAt.getTime()) {
    throw new AppError('VALIDATION_ERROR')
  }
  if (!isIanaTimeZone(details.timezone)) throw new AppError('VALIDATION_ERROR')
}

function isIanaTimeZone(timezone: string): boolean {
  // Intl accepts offsets such as "GMT-3" and "+03:00"; only IANA names ("Area/City", or "UTC") pass.
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(timezone) || /^(GMT|UTC)[+-]/.test(timezone)) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}
