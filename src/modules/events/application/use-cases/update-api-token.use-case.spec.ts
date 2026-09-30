import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ApiToken } from '../../domain/api-token.entity.js'
import type { Event } from '../../domain/event.entity.js'
import { newApiTokenProps } from '../testing/api-token-fixtures.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryApiTokenRepository } from '../testing/in-memory-api-token.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { UpdateApiTokenUseCase } from './update-api-token.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }
const NOW = new Date('2026-09-30T12:00:00.000Z')

describe('UpdateApiTokenUseCase', () => {
  let events: InMemoryEventRepository
  let apiTokens: InMemoryApiTokenRepository
  let updateApiToken: UpdateApiTokenUseCase
  let event: Event
  let apiToken: ApiToken

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    apiTokens = new InMemoryApiTokenRepository()
    updateApiToken = new UpdateApiTokenUseCase(events, apiTokens, new FixedClock(NOW))
    event = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
    apiToken = await apiTokens.create(
      newApiTokenProps(event.id, { name: 'Site', scopes: ['event:read', 'rsvp:create'] }),
      SUPER_ADMIN_STAMP,
    )
  })

  const update = (
    actor: typeof owner,
    changes: Parameters<UpdateApiTokenUseCase['execute']>[0]['changes'],
  ) => updateApiToken.execute({ actor, eventId: event.id, apiTokenId: apiToken.id, changes })

  it('lets an Owner rename it and widen its Scopes, keeping the same value', async () => {
    const updated = await update(owner, {
      name: ' Site novo ',
      scopes: ['event:read', 'rsvp:create', 'registry:read', 'contribution:create'],
    })

    expect(updated.name).toBe('Site novo')
    expect(updated.scopes).toEqual([
      'event:read',
      'rsvp:create',
      'registry:read',
      'contribution:create',
    ])
    expect(updated.tokenHash).toBe(apiToken.tokenHash)
    expect(updated.updatedById).toBe(10)
    expect(updated.updatedAt).toEqual(NOW)
    expect((await apiTokens.findInEvent(event.id, apiToken.id))?.name).toBe('Site novo')
  })

  it('deactivates and reactivates it', async () => {
    expect((await update(owner, { isActive: false })).isActive).toBe(false)
    expect((await update(owner, { isActive: true })).isActive).toBe(true)
  })

  it('refuses an empty or repeated set of Scopes', async () => {
    for (const scopes of [[], ['rsvp:create', 'rsvp:create']] as const) {
      await expect(update(owner, { scopes: [...scopes] })).rejects.toEqual(
        new AppError('VALIDATION_ERROR'),
      )
    }
  })

  it('refuses a Manager with FORBIDDEN', async () => {
    await expect(update(manager, { isActive: false })).rejects.toEqual(new AppError('FORBIDDEN'))
  })

  it('lets an Owner only deactivate it on an Archived event (ADR-0011)', async () => {
    event.archive(SUPER_ADMIN_STAMP)
    await events.save(event)

    for (const changes of [
      { name: 'Outro' },
      { scopes: ['event:read' as const] },
      { isActive: true },
      { isActive: false, name: 'Outro' },
    ]) {
      await expect(update(owner, changes)).rejects.toEqual(new AppError('EVENT_ARCHIVED'))
    }
    expect((await update(owner, { isActive: false })).isActive).toBe(false)
    expect((await update(superAdmin, { isActive: true })).isActive).toBe(true)
  })
})
