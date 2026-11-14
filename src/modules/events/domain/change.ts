/** A value as a Change keeps it, before or after: plain data, never an entity or a value object. */
export type ChangeValue =
  string | number | boolean | null | ChangeValue[] | { [key: string]: ChangeValue }

/**
 * One step recorded on an Event or an Event item (CONTEXT.md, Change): who changed what, when,
 * from what to what, whether only the production sees it, and who it reached
 * before and after (ADR-0019). The reach is stored as it was, never rebuilt.
 * A Change is written once, in the same unit as the change it records
 * (amendment of ADR-0010), with the Stamp of that change, and never edited.
 */
export interface NewChange {
  /**
   * The Event item that changed; null for a Change of the Event itself. Kept
   * as it was after the item is deleted: the Change outlives it.
   */
  eventItemId: number | null
  /**
   * The attribute that changed: `name`, `place`, `period`, `state` on an
   * Event, or `itemOrder` for a new order of the production (the ids of the
   * tied items, before and after; only the production sees it); `name`,
   * `date`, `time`, `place` on an Event item, or `item` for its creation
   * (before null) and its removal (after null).
   */
  attribute: string
  before: ChangeValue
  after: ChangeValue
  /** Only the production (Owners and the Super admin) sees it in the Change log. */
  productionOnly: boolean
  /** The ids of the Users the change reached right before it. */
  reachBefore: number[]
  /** The ids of the Users the change reaches right after it. */
  reachAfter: number[]
}

/** A Change of an Event, as stored: with its Author and instant, the Stamp of the change. */
export interface Change extends NewChange {
  id: number
  eventId: number
  /** The Author: the User who made the change; null when no User made it. */
  by: number | null
  /** The instant of the change, from the Clock. */
  at: Date
}
