import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newApiTokenProps } from '../testing/api-token-fixtures.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryApiTokenRepository } from '../testing/in-memory-api-token.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { ListApiTokensUseCase } from './list-api-tokens.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }
const viewer = { id: 12, isSuperAdmin: false }

describe('ListApiTokensUseCase', () => {
  let events: InMemoryEventRepository
  let apiTokens: InMemoryApiTokenRepository
  let listApiTokens: ListApiTokensUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    apiTokens = new InMemoryApiTokenRepository()
    listApiTokens = new ListApiTokensUseCase(events, apiTokens)
    event = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
    events.addMember(event.id, 12, { role: 'VIEWER', isPrimaryOwner: false })
  })

  it("lists only the Event's tokens to an Owner and to the Super admin", async () => {
    const other = await events.create(newEventProps(), null, SUPER_ADMIN_STAMP)
    await apiTokens.create(newApiTokenProps(event.id, { name: 'Site' }), SUPER_ADMIN_STAMP)
    await apiTokens.create(newApiTokenProps(other.id, { name: 'Outro' }), SUPER_ADMIN_STAMP)
    await apiTokens.create(newApiTokenProps(event.id, { name: 'Teste' }), SUPER_ADMIN_STAMP)

    for (const actor of [owner, superAdmin]) {
      const listed = await listApiTokens.execute({ actor, eventId: event.id })
      expect(listed.map((t) => t.name)).toEqual(['Site', 'Teste'])
    }
  })

  it('refuses Managers and Viewers with FORBIDDEN, even on an Archived event', async () => {
    for (const status of ['ACTIVE', 'ARCHIVED']) {
      if (status === 'ARCHIVED') {
        event.archive(SUPER_ADMIN_STAMP)
        await events.save(event)
      }
      for (const actor of [manager, viewer]) {
        await expect(listApiTokens.execute({ actor, eventId: event.id })).rejects.toEqual(
          new AppError('FORBIDDEN'),
        )
      }
    }
    // Owners still see them, to revoke one (ADR-0011).
    expect(await listApiTokens.execute({ actor: owner, eventId: event.id })).toEqual([])
  })
})
