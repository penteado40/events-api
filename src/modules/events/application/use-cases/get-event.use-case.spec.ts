import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { GetEventUseCase } from './get-event.use-case.js'

describe('GetEventUseCase', () => {
  let events: InMemoryEventRepository
  let getEvent: GetEventUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    getEvent = new GetEventUseCase(events)
    event = await events.create(newEventProps(), 10)
    events.addMember(event.id, 11, { role: 'VIEWER', isPrimaryOwner: false })
  })

  it('returns the Event with the member’s Membership, for any role', async () => {
    const asOwner = await getEvent.execute({
      actor: { id: 10, isSuperAdmin: false },
      eventId: event.id,
    })
    const asViewer = await getEvent.execute({
      actor: { id: 11, isSuperAdmin: false },
      eventId: event.id,
    })

    expect(asOwner.event.id).toBe(event.id)
    expect(asOwner.membership).toEqual({ role: 'OWNER', isPrimaryOwner: true })
    expect(asViewer.membership).toEqual({ role: 'VIEWER', isPrimaryOwner: false })
  })

  it('returns any Event to the Super admin, with no Membership', async () => {
    const result = await getEvent.execute({
      actor: { id: 1, isSuperAdmin: true },
      eventId: event.id,
    })

    expect(result.event.id).toBe(event.id)
    expect(result.membership).toBeNull()
  })

  it('refuses a non-member with FORBIDDEN, whether or not the Event exists', async () => {
    const stranger = { id: 12, isSuperAdmin: false }

    for (const eventId of [event.id, 999]) {
      await expect(getEvent.execute({ actor: stranger, eventId })).rejects.toEqual(
        new AppError('FORBIDDEN'),
      )
    }
  })

  it('answers NOT_FOUND to the Super admin for an unknown Event', async () => {
    await expect(
      getEvent.execute({ actor: { id: 1, isSuperAdmin: true }, eventId: 999 }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })
})
