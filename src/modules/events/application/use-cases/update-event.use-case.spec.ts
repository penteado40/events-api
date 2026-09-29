import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { UpdateEventUseCase } from './update-event.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }
const viewer = { id: 12, isSuperAdmin: false }

describe('UpdateEventUseCase', () => {
  let events: InMemoryEventRepository
  let updateEvent: UpdateEventUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    updateEvent = new UpdateEventUseCase(events, { allowLocalhost: false })
    event = await events.create(
      newEventProps({
        name: 'Casamento',
        startsAt: new Date('2026-11-14T22:00:00.000Z'),
        endsAt: new Date('2026-11-15T04:00:00.000Z'),
      }),
      10,
    )
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
    events.addMember(event.id, 12, { role: 'VIEWER', isPrimaryOwner: false })
  })

  it('lets a Manager edit the details of the happening', async () => {
    const { event: updated, membership } = await updateEvent.execute({
      actor: manager,
      eventId: event.id,
      changes: {
        name: '  Casamento da Ana  ',
        type: 'PARTY',
        venueName: 'Casa Vilella',
        city: null,
      },
    })

    expect(updated.name).toBe('Casamento da Ana')
    expect(updated.type).toBe('PARTY')
    expect(updated.venueName).toBe('Casa Vilella')
    expect(membership).toEqual({ role: 'MANAGER', isPrimaryOwner: false })
    expect((await events.findById(event.id))?.name).toBe('Casamento da Ana')
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    await expect(
      updateEvent.execute({ actor: viewer, eventId: event.id, changes: { name: 'X' } }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('lets an Owner or the Super admin change the siteUrl, as a pure origin', async () => {
    await updateEvent.execute({
      actor: owner,
      eventId: event.id,
      changes: { siteUrl: 'https://novo-site.com/' },
    })
    expect((await events.findById(event.id))?.siteUrl.value).toBe('https://novo-site.com')

    await updateEvent.execute({
      actor: superAdmin,
      eventId: event.id,
      changes: { siteUrl: 'https://outro-site.com' },
    })
    expect((await events.findById(event.id))?.siteUrl.value).toBe('https://outro-site.com')
  })

  it('refuses the whole request of a Manager that sends a siteUrl, even the current one', async () => {
    for (const siteUrl of ['https://outro.com', 'https://evento.com']) {
      await expect(
        updateEvent.execute({
          actor: manager,
          eventId: event.id,
          changes: { name: 'Novo nome', siteUrl },
        }),
      ).rejects.toEqual(new AppError('FORBIDDEN'))
    }
    expect((await events.findById(event.id))?.name).toBe('Casamento')
  })

  it('checks the end against the resulting start', async () => {
    await expect(
      updateEvent.execute({
        actor: owner,
        eventId: event.id,
        changes: { startsAt: new Date('2026-11-15T05:00:00.000Z') },
      }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    expect((await events.findById(event.id))?.startsAt).toEqual(
      new Date('2026-11-14T22:00:00.000Z'),
    )

    const { event: updated } = await updateEvent.execute({
      actor: owner,
      eventId: event.id,
      changes: { startsAt: new Date('2026-11-15T05:00:00.000Z'), endsAt: null },
    })
    expect(updated.endsAt).toBeNull()
  })

  it('refuses members on an Archived event with EVENT_ARCHIVED, but lets the Super admin edit it', async () => {
    event.archive()
    await events.save(event)

    await expect(
      updateEvent.execute({ actor: owner, eventId: event.id, changes: { name: 'X' } }),
    ).rejects.toEqual(new AppError('EVENT_ARCHIVED'))
    await expect(
      updateEvent.execute({ actor: viewer, eventId: event.id, changes: { name: 'X' } }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))

    await expect(
      updateEvent.execute({
        actor: manager,
        eventId: event.id,
        changes: { siteUrl: 'https://outro.com' },
      }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))

    const { event: updated } = await updateEvent.execute({
      actor: superAdmin,
      eventId: event.id,
      changes: { name: 'Corrigido' },
    })
    expect(updated.name).toBe('Corrigido')
  })
})
