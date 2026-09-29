import { beforeEach, describe, expect, it } from 'vitest'
import { Slug } from '../../domain/slug.vo.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { ListEventsUseCase } from './list-events.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const ana = { id: 10, isSuperAdmin: false }

describe('ListEventsUseCase', () => {
  let events: InMemoryEventRepository
  let listEvents: ListEventsUseCase

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    listEvents = new ListEventsUseCase(events)

    const wedding = await events.create(
      newEventProps({
        slug: Slug.create('casamento'),
        startsAt: new Date('2024-05-01T12:00:00.000Z'),
      }),
      10,
      SUPER_ADMIN_STAMP,
    )
    wedding.archive(SUPER_ADMIN_STAMP)
    await events.save(wedding)
    const birthday = await events.create(
      newEventProps({
        slug: Slug.create('aniversario'),
        startsAt: new Date('2026-11-14T22:00:00.000Z'),
      }),
      null,
      SUPER_ADMIN_STAMP,
    )
    events.addMember(birthday.id, 10, { role: 'MANAGER', isPrimaryOwner: false })
    await events.create(
      newEventProps({ slug: Slug.create('de-outra-pessoa') }),
      11,
      SUPER_ADMIN_STAMP,
    )
  })

  it('lists only the member’s Events, archived included, newest start first, with their Membership', async () => {
    const result = await listEvents.execute({ actor: ana })

    expect(result.map((r) => [r.event.slug.value, r.event.status, r.membership])).toEqual([
      ['aniversario', 'ACTIVE', { role: 'MANAGER', isPrimaryOwner: false }],
      ['casamento', 'ARCHIVED', { role: 'OWNER', isPrimaryOwner: true }],
    ])
  })

  it('filters by status', async () => {
    const result = await listEvents.execute({ actor: ana, status: 'ARCHIVED' })

    expect(result.map((r) => r.event.slug.value)).toEqual(['casamento'])
  })

  it('lists every Event to the Super admin, with no Membership', async () => {
    const result = await listEvents.execute({ actor: superAdmin })

    expect(result.map((r) => r.event.slug.value).sort()).toEqual([
      'aniversario',
      'casamento',
      'de-outra-pessoa',
    ])
    expect(result.every((r) => r.membership === null)).toBe(true)
  })
})
