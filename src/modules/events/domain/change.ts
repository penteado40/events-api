/** A value as a Change keeps it, before or after: plain data, never an entity or a value object. */
export type ChangeValue =
  string | number | boolean | null | ChangeValue[] | { [key: string]: ChangeValue }

/**
 * One step recorded on an Event (CONTEXT.md, Change): who changed what, when,
 * from what to what, whether only the production sees it, and who it reached
 * before and after (ADR-0019). The reach is stored as it was, never rebuilt.
 * A Change is written once, in the same unit as the change it records
 * (amendment of ADR-0010), and never edited.
 */
export interface NewChange {
  /** The attribute that changed (`name`, `place`, `period`, `state` on an Event). */
  attribute: string
  before: ChangeValue
  after: ChangeValue
  /** Only the production (Owners and the Super admin) sees it in the Change log. */
  productionOnly: boolean
  /** The ids of the Users the change reached right before it. */
  reachBefore: number[]
  /** The ids of the Users the change reaches right after it. */
  reachAfter: number[]
  /** The Author: the User who made the change; null when no User made it. */
  by: number | null
  /** The instant of the change, from the Clock. */
  at: Date
}

/** A Change of an Event, as stored. */
export interface Change extends NewChange {
  id: number
  eventId: number
}
