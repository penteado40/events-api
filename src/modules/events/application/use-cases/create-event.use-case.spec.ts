import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { CreateEventUseCase } from './create-event.use-case.js'

const NOW = new Date('2026-11-01T12:00:00.000Z')

describe('CreateEventUseCase', () => {
  let directory: FakeGroupDirectory
  let events: InMemoryEventRepository
  let createEvent: CreateEventUseCase

  beforeEach(() => {
    directory = new FakeGroupDirectory().addGroup(1)
    events = new InMemoryEventRepository()
    createEvent = new CreateEventUseCase(directory, events, new FixedClock(NOW))
  })

  it('lets an Owner create an Event in Draft, with where and when as written, as its Author', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    const { event, isFinished } = await createEvent.execute({
      actor: ANA,
      groupId: 1,
      name: ' Show em Manaus ',
      place: ' Teatro Amazonas ',
      period: MANAUS_PERIOD,
    })

    expect(event).toMatchObject({
      groupId: 1,
      name: 'Show em Manaus',
      place: 'Teatro Amazonas',
      state: 'DRAFT',
      createdById: ANA.id,
      updatedById: ANA.id,
      createdAt: NOW,
    })
    expect(event.period.startDate.value).toBe('2026-11-13')
    expect(event.period.endDate.value).toBe('2026-11-16')
    expect(event.period.timezone.value).toBe('America/Manaus')
    expect(isFinished).toBe(false)
    expect(await events.findByGroup(1)).toHaveLength(1)
  })

  it('lets the Super admin create an Event in any Group', async () => {
    const { event } = await createEvent.execute({
      actor: SUPER_ADMIN,
      groupId: 1,
      name: 'Ensaio',
      place: 'Sede',
      period: { startDate: '2026-11-05', endDate: '2026-11-05', timezone: 'America/Sao_Paulo' },
    })

    expect(event.createdById).toBe(SUPER_ADMIN.id)
  })

  it('refuses an end date before the start date with EVENT_PERIOD_INVALID', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await expect(
      createEvent.execute({
        actor: ANA,
        groupId: 1,
        name: 'Show em Manaus',
        place: 'Manaus',
        period: { startDate: '2026-11-16', endDate: '2026-11-13', timezone: 'America/Manaus' },
      }),
    ).rejects.toEqual(new AppError('EVENT_PERIOD_INVALID'))
    expect(await events.findByGroup(1)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(
      createEvent.execute({
        actor: ANA,
        groupId: 1,
        name: 'Show',
        place: 'Manaus',
        period: MANAUS_PERIOD,
      }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('answers NOT_FOUND to who is not a Group member, and for a Group that does not exist', async () => {
    const input = { name: 'Show', place: 'Manaus', period: MANAUS_PERIOD }

    await expect(createEvent.execute({ actor: ANA, groupId: 1, ...input })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(
      createEvent.execute({ actor: SUPER_ADMIN, groupId: 42, ...input }),
    ).rejects.toEqual(new AppError('NOT_FOUND'))
  })

  it('refuses an empty name or place, or a zone that is not IANA, with VALIDATION_ERROR', async () => {
    const valid = { actor: SUPER_ADMIN, groupId: 1, name: 'Show', place: 'Manaus' }

    await expect(
      createEvent.execute({ ...valid, name: '  ', period: MANAUS_PERIOD }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    await expect(
      createEvent.execute({ ...valid, place: '', period: MANAUS_PERIOD }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    await expect(
      createEvent.execute({ ...valid, period: { ...MANAUS_PERIOD, timezone: '-04:00' } }),
    ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
  })
})
