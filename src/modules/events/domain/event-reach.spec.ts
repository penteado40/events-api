import { describe, expect, it } from 'vitest'
import { eventReach } from './event-reach.js'

describe('eventReach', () => {
  it('reaches every Group member, Viewers included, in the order given', () => {
    expect(
      eventReach([
        { userId: 11, role: 'VIEWER' },
        { userId: 10, role: 'OWNER' },
      ]),
    ).toEqual([11, 10])
  })
})
