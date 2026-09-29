import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { ArchiveEventUseCase } from './archive-event.use-case.js'

const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }
const coOwner = { id: 13, isSuperAdmin: false }
const NOW = new Date('2026-09-29T12:00:00.000Z')
const LATER = new Date('2026-09-30T08:00:00.000Z')

describe('ArchiveEventUseCase', () => {
  let events: InMemoryEventRepository
  let clock: FixedClock
  let archiveEvent: ArchiveEventUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    clock = new FixedClock(NOW)
    archiveEvent = new ArchiveEventUseCase(events, clock)
    event = await events.create(newEventProps(), 10, { by: 1, at: NOW })
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
    events.addMember(event.id, 13, { role: 'OWNER', isPrimaryOwner: false })
  })

  it('lets an Owner archive, idempotently', async () => {
    const first = await archiveEvent.execute({ actor: owner, eventId: event.id })
    const again = await archiveEvent.execute({ actor: owner, eventId: event.id })

    expect(first.event.status).toBe('ARCHIVED')
    expect(again.event.status).toBe('ARCHIVED')
    expect((await events.findById(event.id))?.status).toBe('ARCHIVED')
  })

  it('records the Owner who archived as the Author, and not one who repeats it', async () => {
    clock.set(LATER)
    await archiveEvent.execute({ actor: owner, eventId: event.id })
    clock.set(new Date('2026-10-01T08:00:00.000Z'))
    await archiveEvent.execute({ actor: coOwner, eventId: event.id })

    const stored = await events.findById(event.id)
    expect(stored?.updatedById).toBe(10)
    expect(stored?.updatedAt).toEqual(LATER)
  })

  it('refuses a Manager archiving with FORBIDDEN', async () => {
    await expect(archiveEvent.execute({ actor: manager, eventId: event.id })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })
})
