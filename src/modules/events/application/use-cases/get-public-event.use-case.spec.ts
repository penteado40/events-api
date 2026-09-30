import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import type { SiteCredential } from '../site-credential.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { GetPublicEventUseCase } from './get-public-event.use-case.js'

const viewer = { id: 12, isSuperAdmin: false }
const outsider = { id: 13, isSuperAdmin: false }

describe('GetPublicEventUseCase', () => {
  let events: InMemoryEventRepository
  let getPublicEvent: GetPublicEventUseCase
  let event: Event
  let other: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    getPublicEvent = new GetPublicEventUseCase(events)
    event = await events.create(newEventProps({ name: 'Aniversário' }), 10, SUPER_ADMIN_STAMP)
    other = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    events.addMember(event.id, 12, { role: 'VIEWER', isPrimaryOwner: false })
  })

  const site = (overrides: Partial<SiteCredential> = {}): SiteCredential => ({
    apiTokenId: 1,
    eventId: event.id,
    scopes: ['event:read'],
    ...overrides,
  })

  it('gives the Site of the Event its Event, with the Scope event:read', async () => {
    const found = await getPublicEvent.execute({ actor: site(), eventId: event.id })
    expect(found.name).toBe('Aniversário')
  })

  it('keeps answering the Site once the Event is archived', async () => {
    event.archive(SUPER_ADMIN_STAMP)
    await events.save(event)

    const found = await getPublicEvent.execute({ actor: site(), eventId: event.id })
    expect(found.status).toBe('ARCHIVED')
  })

  it('refuses a token without event:read with INSUFFICIENT_SCOPE', async () => {
    await expect(
      getPublicEvent.execute({ actor: site({ scopes: ['rsvp:create'] }), eventId: event.id }),
    ).rejects.toEqual(new AppError('INSUFFICIENT_SCOPE'))
  })

  it('refuses another Event, existing or not, with FORBIDDEN', async () => {
    for (const eventId of [other.id, 999]) {
      await expect(getPublicEvent.execute({ actor: site(), eventId })).rejects.toEqual(
        new AppError('FORBIDDEN'),
      )
    }
  })

  it('lets a member preview what the Site reads, and refuses a non-member', async () => {
    expect((await getPublicEvent.execute({ actor: viewer, eventId: event.id })).id).toBe(event.id)
    await expect(getPublicEvent.execute({ actor: outsider, eventId: event.id })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })
})
