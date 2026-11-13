import type { DomainEvent } from '../../domain/domain-event.js'

/**
 * Tells the other contexts what happened (ADR-0010). Call it only after the
 * commit; delivery is best effort and never reaches back to the caller: a
 * handler that fails does not fail the action that published.
 */
export abstract class EventPublisher {
  abstract publish(events: DomainEvent[]): void
}
