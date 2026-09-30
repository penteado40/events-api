/** The current time. Use cases read it here, never from `new Date()`, so tests control it. */
export abstract class Clock {
  abstract now(): Date
}
