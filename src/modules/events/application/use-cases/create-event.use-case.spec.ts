import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Requester } from '../requester.js'
import { FakeUserDirectory } from '../testing/fake-user-directory.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { type CreateEventInput, CreateEventUseCase } from './create-event.use-case.js'

const superAdmin: Requester = { id: 1, isSuperAdmin: true }
const ana: Requester = { id: 2, isSuperAdmin: false }

function input(overrides: Partial<CreateEventInput> = {}): CreateEventInput {
  return {
    actor: superAdmin,
    type: 'BIRTHDAY',
    name: 'Aniversário da Ana',
    slug: 'aniversario-da-ana',
    siteUrl: 'https://festa-da-ana.com',
    startsAt: new Date('2026-11-14T22:00:00.000Z'),
    ...overrides,
  }
}

describe('CreateEventUseCase', () => {
  let events: InMemoryEventRepository
  let users: FakeUserDirectory
  let createEvent: CreateEventUseCase

  beforeEach(() => {
    events = new InMemoryEventRepository()
    users = new FakeUserDirectory()
    users.add({ id: 1, isSuperAdmin: true })
    users.add({ id: 2, isSuperAdmin: false })
    createEvent = new CreateEventUseCase(events, users, { allowLocalhost: false })
  })

  it('creates an active Event with the platform defaults', async () => {
    const { event, membership } = await createEvent.execute(input())

    expect(event.status).toBe('ACTIVE')
    expect(event.slug).toBe('aniversario-da-ana')
    expect(event.siteUrl.value).toBe('https://festa-da-ana.com')
    expect(event.timezone).toBe('America/Sao_Paulo')
    expect(event.locale).toBe('pt-BR')
    expect(event.currency).toBe('BRL')
    expect(event.endsAt).toBeNull()
    expect(membership).toBeNull()
  })

  it('makes the given User the Primary owner, even a Pending user', async () => {
    const { event } = await createEvent.execute(input({ primaryOwnerUserId: 2 }))

    expect(await events.findMembership(event.id, 2)).toEqual({
      role: 'OWNER',
      isPrimaryOwner: true,
    })
  })

  it('refuses a Super admin or an unknown User as Primary owner with PRIMARY_OWNER_INVALID', async () => {
    for (const primaryOwnerUserId of [1, 99]) {
      await expect(createEvent.execute(input({ primaryOwnerUserId }))).rejects.toEqual(
        new AppError('PRIMARY_OWNER_INVALID'),
      )
    }
    expect(events.all()).toHaveLength(0)
  })

  it('refuses anyone but the Super admin with FORBIDDEN', async () => {
    await expect(createEvent.execute(input({ actor: ana }))).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
  })

  it('refuses a slug already in use with SLUG_ALREADY_IN_USE', async () => {
    await createEvent.execute(input())

    await expect(createEvent.execute(input({ siteUrl: 'https://outra.com' }))).rejects.toEqual(
      new AppError('SLUG_ALREADY_IN_USE'),
    )
  })

  it('accepts a siteUrl already used by another Event', async () => {
    await createEvent.execute(input())
    const { event } = await createEvent.execute(input({ slug: 'aniversario-2027' }))

    expect(event.siteUrl.value).toBe('https://festa-da-ana.com')
  })

  it('keeps only the origin of the siteUrl, and refuses one with a path, http or no https', async () => {
    const { event } = await createEvent.execute(input({ siteUrl: 'https://Festa.com:8443/' }))
    expect(event.siteUrl.value).toBe('https://festa.com:8443')

    for (const siteUrl of [
      'https://festa.com/rsvp',
      'https://festa.com/?a=1',
      'http://festa.com',
      'http://localhost:3000',
      'festa.com',
    ]) {
      await expect(createEvent.execute(input({ slug: 'outro', siteUrl }))).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
    }
  })

  it('accepts http://localhost when allowed (outside production)', async () => {
    const dev = new CreateEventUseCase(events, users, { allowLocalhost: true })

    const { event } = await dev.execute(input({ siteUrl: 'http://localhost:3000' }))

    expect(event.siteUrl.value).toBe('http://localhost:3000')
  })

  it('accepts a start in the past and refuses an end that is not after the start', async () => {
    const { event } = await createEvent.execute(
      input({ startsAt: new Date('2025-01-10T12:00:00.000Z') }),
    )
    expect(event.startsAt).toEqual(new Date('2025-01-10T12:00:00.000Z'))

    for (const endsAt of [
      new Date('2026-11-14T22:00:00.000Z'),
      new Date('2026-11-14T21:00:00.000Z'),
    ]) {
      await expect(createEvent.execute(input({ slug: 'outro', endsAt }))).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
    }
  })

  it('accepts IANA time zones only', async () => {
    const { event } = await createEvent.execute(input({ timezone: 'America/Manaus' }))
    expect(event.timezone).toBe('America/Manaus')

    for (const timezone of ['GMT-3', '+03:00', 'America/Sao_Paulo ', 'Mars/Olympus']) {
      await expect(createEvent.execute(input({ slug: 'outro', timezone }))).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
    }
  })
})
