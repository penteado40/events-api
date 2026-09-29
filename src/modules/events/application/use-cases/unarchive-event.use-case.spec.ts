import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { UnarchiveEventUseCase } from './unarchive-event.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const owner = { id: 10, isSuperAdmin: false }
const NOW = new Date('2026-09-29T12:00:00.000Z')
const LATER = new Date('2026-09-30T08:00:00.000Z')

describe('UnarchiveEventUseCase', () => {
  let events: InMemoryEventRepository
  let clock: FixedClock
  let unarchiveEvent: UnarchiveEventUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    clock = new FixedClock(LATER)
    unarchiveEvent = new UnarchiveEventUseCase(events, clock)
    event = await events.create(newEventProps(), 10, { by: 1, at: NOW })
    event.archive({ by: 10, at: NOW })
    await events.save(event)
  })

  it('lets only the Super admin unarchive, idempotently', async () => {
    await expect(unarchiveEvent.execute({ actor: owner, eventId: event.id })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    const first = await unarchiveEvent.execute({ actor: superAdmin, eventId: event.id })
    const again = await unarchiveEvent.execute({ actor: superAdmin, eventId: event.id })

    expect(first.event.status).toBe('ACTIVE')
    expect(again.event.status).toBe('ACTIVE')
    expect((await events.findById(event.id))?.status).toBe('ACTIVE')
  })

  it('records the Super admin as the Author of the unarchiving', async () => {
    await unarchiveEvent.execute({ actor: superAdmin, eventId: event.id })

    const stored = await events.findById(event.id)
    expect(stored?.updatedById).toBe(1)
    expect(stored?.updatedAt).toEqual(LATER)
  })
})
