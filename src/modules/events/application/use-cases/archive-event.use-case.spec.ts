import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { ArchiveEventUseCase } from './archive-event.use-case.js'

const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }

describe('ArchiveEventUseCase', () => {
  let events: InMemoryEventRepository
  let archiveEvent: ArchiveEventUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    archiveEvent = new ArchiveEventUseCase(events)
    event = await events.create(newEventProps(), 10)
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
  })

  it('lets an Owner archive, idempotently', async () => {
    const first = await archiveEvent.execute({ actor: owner, eventId: event.id })
    const again = await archiveEvent.execute({ actor: owner, eventId: event.id })

    expect(first.event.status).toBe('ARCHIVED')
    expect(again.event.status).toBe('ARCHIVED')
    expect((await events.findById(event.id))?.status).toBe('ARCHIVED')
  })

  it('refuses a Manager archiving with FORBIDDEN', async () => {
    await expect(archiveEvent.execute({ actor: manager, eventId: event.id })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })
})
