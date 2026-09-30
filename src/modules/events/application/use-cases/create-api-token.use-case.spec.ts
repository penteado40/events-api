import { beforeEach, describe, expect, it } from 'vitest'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import { FakeSecretTokens } from '../../../../shared/application/testing/fake-secret-tokens.js'
import type { Event } from '../../domain/event.entity.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryApiTokenRepository } from '../testing/in-memory-api-token.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { CreateApiTokenUseCase } from './create-api-token.use-case.js'

const superAdmin = { id: 1, isSuperAdmin: true }
const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }
const viewer = { id: 12, isSuperAdmin: false }
const outsider = { id: 13, isSuperAdmin: false }
const NOW = new Date('2026-09-30T12:00:00.000Z')

describe('CreateApiTokenUseCase', () => {
  let events: InMemoryEventRepository
  let apiTokens: InMemoryApiTokenRepository
  let secrets: FakeSecretTokens
  let createApiToken: CreateApiTokenUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    apiTokens = new InMemoryApiTokenRepository()
    secrets = new FakeSecretTokens()
    createApiToken = new CreateApiTokenUseCase(events, apiTokens, secrets, new FixedClock(NOW))
    event = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
    events.addMember(event.id, 12, { role: 'VIEWER', isPrimaryOwner: false })
  })

  it('gives an Owner the value once, and keeps only its hash', async () => {
    const { apiToken, value } = await createApiToken.execute({
      actor: owner,
      eventId: event.id,
      name: '  Site do casamento  ',
      scopes: ['event:read', 'rsvp:create'],
    })

    expect(value).toBe('evt_secret-1')
    expect(apiToken.eventId).toBe(event.id)
    expect(apiToken.name).toBe('Site do casamento')
    expect(apiToken.scopes).toEqual(['event:read', 'rsvp:create'])
    expect(apiToken.isActive).toBe(true)
    expect(apiToken.lastUsedAt).toBeNull()
    expect(apiToken.createdById).toBe(10)
    expect(apiToken.createdAt).toEqual(NOW)

    const stored = await apiTokens.findByHash('hash:evt_secret-1')
    expect(stored?.id).toBe(apiToken.id)
    expect(stored?.tokenHash).toBe('hash:evt_secret-1')
  })

  it('refuses Managers, Viewers and non-members with FORBIDDEN', async () => {
    for (const actor of [manager, viewer, outsider]) {
      await expect(
        createApiToken.execute({ actor, eventId: event.id, name: 'Site', scopes: ['event:read'] }),
      ).rejects.toEqual(new AppError('FORBIDDEN'))
    }
    expect(await apiTokens.listByEvent(event.id)).toEqual([])
  })

  it('refuses a token without Scopes, with a repeated Scope or with a blank name', async () => {
    for (const input of [
      { name: 'Site', scopes: [] },
      { name: 'Site', scopes: ['event:read', 'event:read'] as const },
      { name: '   ', scopes: ['event:read'] as const },
    ]) {
      await expect(
        createApiToken.execute({
          actor: owner,
          eventId: event.id,
          ...input,
          scopes: [...input.scopes],
        }),
      ).rejects.toEqual(new AppError('VALIDATION_ERROR'))
    }
  })

  it('refuses an Owner on an Archived event with EVENT_ARCHIVED, but lets the Super admin create', async () => {
    event.archive(SUPER_ADMIN_STAMP)
    await events.save(event)

    await expect(
      createApiToken.execute({
        actor: owner,
        eventId: event.id,
        name: 'Site',
        scopes: ['event:read'],
      }),
    ).rejects.toEqual(new AppError('EVENT_ARCHIVED'))

    const { apiToken } = await createApiToken.execute({
      actor: superAdmin,
      eventId: event.id,
      name: 'Site',
      scopes: ['event:read'],
    })
    expect(apiToken.createdById).toBe(1)
  })
})
