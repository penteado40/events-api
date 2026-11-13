import type { Stamp } from '../../../../shared/domain/stamp.js'
import type { Change, NewChange } from '../../domain/change.js'
import { ChangeRepository } from '../../domain/change.repository.js'

export class InMemoryChangeRepository extends ChangeRepository {
  private readonly changes: Change[] = []
  private nextId = 1

  async create(eventId: number, changes: readonly NewChange[], stamp: Stamp): Promise<void> {
    for (const change of changes) {
      this.changes.push({ id: this.nextId++, eventId, ...change, by: stamp.by, at: stamp.at })
    }
  }

  /** The Changes of the Event, in the order they were written. Helper for test assertions. */
  ofEvent(eventId: number): Change[] {
    return this.changes.filter((c) => c.eventId === eventId)
  }
}
