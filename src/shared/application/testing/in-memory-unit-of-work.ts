import { AsyncLocalStorage } from 'node:async_hooks'
import { UnitOfWork } from '../unit-of-work.js'

/**
 * Runs one unit at a time, as if every unit took the same lock; a run inside
 * another joins it. Nothing rolls back: the in-memory stores write right away.
 */
export class InMemoryUnitOfWork extends UnitOfWork {
  private readonly inside = new AsyncLocalStorage<true>()
  private queue: Promise<unknown> = Promise.resolve()
  private count = 0

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.inside.getStore()) return work()
    this.count += 1
    const result = this.queue.then(() => this.inside.run(true, work))
    this.queue = result.catch(() => undefined)
    return result
  }

  /** How many units ran, not counting the ones that joined another. */
  runs(): number {
    return this.count
  }
}
