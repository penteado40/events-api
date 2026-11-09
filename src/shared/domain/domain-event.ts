/**
 * A fact that happened in a context and that others may react to (ADR-0010).
 * Named in the past, carrying ids and the essential only; `type` is what a
 * handler subscribes to.
 */
export interface DomainEvent {
  readonly type: string
  readonly occurredAt: Date
}

/** An aggregate that records the events of its changes, for the use case to publish after the commit. */
export abstract class AggregateRoot {
  private events: DomainEvent[] = []

  protected record(event: DomainEvent): void {
    this.events.push(event)
  }

  /** Hands over the events recorded since the last pull, once. */
  pullEvents(): DomainEvent[] {
    return this.events.splice(0)
  }
}
