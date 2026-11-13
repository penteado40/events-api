import type { NewChange } from './change.js'

/**
 * The Change log of the Events, append only: a Change is never edited. The
 * use case writes it in the same unit of work as the change it records
 * (amendment of ADR-0010), never from a domain event handler.
 */
export abstract class ChangeRepository {
  abstract add(eventId: number, changes: readonly NewChange[]): Promise<void>
}
