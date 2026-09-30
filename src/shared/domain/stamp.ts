/**
 * Who made a write and when (ADR-0013). Every change to a record carries one:
 * the entity stamps its `updatedById`/`updatedAt` with it, and a new record
 * also takes it as `createdById`/`createdAt`.
 */
export interface Stamp {
  /** The Author's User id; null when no User made the write (the Site, the migration, scripts). */
  by: number | null
  at: Date
}

/** The authorship of a new record: created and last edited by the same write. */
export function createdWith(stamp: Stamp) {
  return {
    createdAt: stamp.at,
    updatedAt: stamp.at,
    createdById: stamp.by,
    updatedById: stamp.by,
  }
}
