import type { Stamp } from '../../../shared/domain/stamp.js'
import type { NewChange } from './change.js'

/**
 * The Change log of the Events, append only: a Change is never edited. The
 * use case writes it in the same unit of work as the change it records
 * (amendment of ADR-0010), never from a domain event handler. The Stamp is
 * the change's: its Author and instant are the Changes' too.
 */
export abstract class ChangeRepository {
  abstract create(eventId: number, changes: readonly NewChange[], stamp: Stamp): Promise<void>
}
