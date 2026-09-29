import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { UnarchiveEventUseCase } from './unarchive-event.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const owner = { id: 10, isSuperAdmin: false }

describe('UnarchiveEventUseCase', () => {
  let events: InMemoryEventRepository
  let unarchiveEvent: UnarchiveEventUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    unarchiveEvent = new UnarchiveEventUseCase(events)
    event = await events.create(newEventProps(), 10)
    event.archive()
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
})
