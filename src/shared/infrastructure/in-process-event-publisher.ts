import { EventPublisher } from '../application/ports/event-publisher.js'
import type { BackgroundTasks } from '../application/background-tasks.js'
import type { DomainEvent } from '../domain/domain-event.js'

export type DomainEventHandler<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void>

/**
 * Delivers events to the handlers of this process, after the response
 * (ADR-0010, ADR-0007). One background task per `publish`: the events go in
 * order, and each one to its handlers in the order they subscribed. A handler
 * that fails is reported to `onHandlerError` and the next one still runs.
 */
export class InProcessEventPublisher extends EventPublisher {
  private readonly handlers = new Map<string, DomainEventHandler[]>()

  constructor(
    private readonly tasks: BackgroundTasks,
    private readonly onHandlerError: (error: unknown, event: DomainEvent) => void,
  ) {
    super()
  }

  /** Subscribes a handler to an event type; returns the function that unsubscribes it. */
  on<E extends DomainEvent>(type: E['type'], handler: DomainEventHandler<E>): () => void {
    const list = this.handlers.get(type) ?? []
    const stored = handler as DomainEventHandler
    this.handlers.set(type, [...list, stored])
    return () => {
      this.handlers.set(
        type,
        (this.handlers.get(type) ?? []).filter((h) => h !== stored),
      )
    }
  }

  publish(events: DomainEvent[]): void {
    if (events.length === 0) return
    const delivery = events.map((event) => ({
      event,
      handlers: [...(this.handlers.get(event.type) ?? [])],
    }))
    this.tasks.run(async () => {
      for (const { event, handlers } of delivery) {
        for (const handler of handlers) {
          try {
            await handler(event)
          } catch (error) {
            this.onHandlerError(error, event)
          }
        }
      }
    })
  }
}
