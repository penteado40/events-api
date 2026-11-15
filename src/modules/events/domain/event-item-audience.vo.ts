import { AppError } from '../../../shared/domain/app-error.js'

export const EVENT_ITEM_AUDIENCE_KINDS = ['ALL', 'SELECTED'] as const
export type EventItemAudienceKind = (typeof EVENT_ITEM_AUDIENCE_KINDS)[number]

/**
 * An Audience as it travels and is stored: "Todos" (ALL), or the people
 * chosen (SELECTED), their User ids once each, in ascending order.
 */
export type EventItemAudienceValues = { kind: 'ALL' } | { kind: 'SELECTED'; userIds: number[] }

/**
 * Whom an Event item reaches (CONTEXT.md, Audience): "Todos", which follows
 * the list of Participants, or a list of people chosen, which never changes
 * by itself. The order of choosing does not matter: the ids are kept once
 * each, in ascending order, so two lists of the same people are equal. That
 * the people chosen are Participants is checked by who chooses them, under
 * the Event's lock; who leaves the Participants leaves the list.
 */
export class EventItemAudience {
  private constructor(private readonly values: EventItemAudienceValues) {}

  static all(): EventItemAudience {
    return new EventItemAudience({ kind: 'ALL' })
  }

  static selected(userIds: readonly number[]): EventItemAudience {
    const ids = [...new Set(userIds)].sort((a, b) => a - b)
    return new EventItemAudience({ kind: 'SELECTED', userIds: ids })
  }

  static create(values: EventItemAudienceValues): EventItemAudience {
    return values.kind === 'ALL'
      ? EventItemAudience.all()
      : EventItemAudience.selected(values.userIds)
  }

  get kind(): EventItemAudienceKind {
    return this.values.kind
  }

  /** The people chosen; none for "Todos". */
  get userIds(): readonly number[] {
    return this.values.kind === 'SELECTED' ? this.values.userIds : []
  }

  /**
   * Refuses an Audience chosen with someone who is not a Participant of the
   * Event (NOT_A_PARTICIPANT): the people chosen are always among them.
   */
  assertWithin(participants: readonly number[]): void {
    if (this.userIds.some((id) => !participants.includes(id))) {
      throw new AppError('NOT_A_PARTICIPANT')
    }
  }

  toValues(): EventItemAudienceValues {
    return this.values.kind === 'ALL'
      ? { kind: 'ALL' }
      : { kind: 'SELECTED', userIds: [...this.values.userIds] }
  }

  equals(other: EventItemAudience): boolean {
    return sameAudience(this.values, other.values)
  }
}

/** Whether two Audiences, as plain data, are the same: same kind and, if chosen, the same people. */
export function sameAudience(a: EventItemAudienceValues, b: EventItemAudienceValues): boolean {
  if (a.kind === 'ALL' || b.kind === 'ALL') return a.kind === b.kind
  return a.userIds.length === b.userIds.length && a.userIds.every((id, i) => id === b.userIds[i])
}
