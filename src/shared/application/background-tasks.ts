/**
 * Work that finishes after the response (ADR-0007): on Vercel, a promise left
 * alone may be frozen with the function. A task's error never reaches whoever
 * scheduled it; the adapter logs it.
 */
export abstract class BackgroundTasks {
  abstract run(task: () => Promise<void>): void
}
