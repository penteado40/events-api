import { BackgroundTasks } from '../background-tasks.js'

/**
 * Starts each task right away, as the real one does, and keeps it so the test
 * can wait for all of them with `settle()`. A task's error goes to `errors`.
 */
export class FakeBackgroundTasks extends BackgroundTasks {
  private readonly pending: Promise<void>[] = []
  readonly errors: unknown[] = []

  run(task: () => Promise<void>): void {
    this.pending.push(
      task().catch((error: unknown) => {
        this.errors.push(error)
      }),
    )
  }

  /** Waits for every task started so far. */
  async settle(): Promise<void> {
    await Promise.all(this.pending.splice(0))
  }
}
