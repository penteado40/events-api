import { Clock } from '../clock.js'

/** A clock that stays where the test puts it. */
export class FixedClock extends Clock {
  constructor(private current: Date) {
    super()
  }

  now(): Date {
    return this.current
  }

  set(at: Date): void {
    this.current = at
  }
}
