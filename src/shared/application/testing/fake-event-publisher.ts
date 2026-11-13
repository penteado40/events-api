import type { DomainEvent } from '../../domain/domain-event.js'
import { EventPublisher } from '../ports/event-publisher.js'

/** Keeps what was published, in order, for the test to read. */
export class FakeEventPublisher extends EventPublisher {
  private readonly events: DomainEvent[] = []

  publish(events: DomainEvent[]): void {
    this.events.push(...events)
  }

  published(): DomainEvent[] {
    return [...this.events]
  }
}
