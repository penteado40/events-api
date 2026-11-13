import { InMemoryUnitOfWork } from '../../../../shared/application/testing/in-memory-unit-of-work.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import { EventItemName } from '../../domain/event-item-name.vo.js'
import { EventItemStart } from '../../domain/event-item-start.vo.js'
import { EventName } from '../../domain/event-name.vo.js'
import { EventPeriod } from '../../domain/event-period.vo.js'
import { EventPlace } from '../../domain/event-place.vo.js'
import { ANA, MANAUS_PERIOD, SUPER_ADMIN } from '../testing/events-fixtures.js'
import { FakeGroupDirectory } from '../testing/fake-group-directory.js'
import { InMemoryEventItemRepository } from '../testing/in-memory-event-item.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { DeleteEventItemUseCase } from './delete-event-item.use-case.js'

const AT = new Date('2026-10-01T12:00:00.000Z')

describe('DeleteEventItemUseCase', () => {
  let directory: FakeGroupDirectory
  let items: InMemoryEventItemRepository
  let deleteItem: DeleteEventItemUseCase
  let eventId: number
  let itemId: number

  beforeEach(async () => {
    directory = new FakeGroupDirectory().addGroup(1)
    const events = new InMemoryEventRepository()
    items = new InMemoryEventItemRepository()
    deleteItem = new DeleteEventItemUseCase(directory, events, items, new InMemoryUnitOfWork())
    eventId = (
      await events.create(
        {
          groupId: 1,
          name: EventName.create('Show em Manaus'),
          place: EventPlace.create('Manaus'),
          period: EventPeriod.create(MANAUS_PERIOD),
        },
        { by: null, at: AT },
      )
    ).id
    itemId = (
      await items.create(
        {
          eventId,
          name: EventItemName.create('O que levar'),
          start: EventItemStart.create({ date: null, time: null }),
          place: null,
        },
        { by: null, at: AT },
      )
    ).id
  })

  it('lets an Owner delete an Event item', async () => {
    directory.addMember(1, ANA.id, 'OWNER')

    await deleteItem.execute({ actor: ANA, eventId, itemId })

    expect(items.ofEvent(eventId)).toEqual([])
  })

  it('lets the Super admin delete an Event item', async () => {
    await deleteItem.execute({ actor: SUPER_ADMIN, eventId, itemId })

    expect(items.ofEvent(eventId)).toEqual([])
  })

  it('refuses a Viewer with FORBIDDEN, keeping the item', async () => {
    directory.addMember(1, ANA.id, 'VIEWER')

    await expect(deleteItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('FORBIDDEN'),
    )
    expect(items.ofEvent(eventId)).toHaveLength(1)
  })

  it('answers NOT_FOUND for an item that does not exist, and to who is not a Group member', async () => {
    await expect(deleteItem.execute({ actor: SUPER_ADMIN, eventId, itemId: 42 })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
    await expect(deleteItem.execute({ actor: ANA, eventId, itemId })).rejects.toEqual(
      new AppError('NOT_FOUND'),
    )
  })
})
