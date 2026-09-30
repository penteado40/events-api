import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ApiToken } from '../../domain/api-token.entity.js'
import type { Event } from '../../domain/event.entity.js'
import { newApiTokenProps } from '../testing/api-token-fixtures.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryApiTokenRepository } from '../testing/in-memory-api-token.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { DeleteApiTokenUseCase } from './delete-api-token.use-case.js'

const owner = { id: 10, isSuperAdmin: false }
const viewer = { id: 12, isSuperAdmin: false }

describe('DeleteApiTokenUseCase', () => {
  let events: InMemoryEventRepository
  let apiTokens: InMemoryApiTokenRepository
  let deleteApiToken: DeleteApiTokenUseCase
  let event: Event
  let apiToken: ApiToken

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    apiTokens = new InMemoryApiTokenRepository()
    deleteApiToken = new DeleteApiTokenUseCase(events, apiTokens)
    event = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    events.addMember(event.id, 12, { role: 'VIEWER', isPrimaryOwner: false })
    apiToken = await apiTokens.create(newApiTokenProps(event.id), SUPER_ADMIN_STAMP)
  })

  it('lets an Owner delete it, even on an Archived event (ADR-0011)', async () => {
    event.archive(SUPER_ADMIN_STAMP)
    await events.save(event)

    await deleteApiToken.execute({ actor: owner, eventId: event.id, apiTokenId: apiToken.id })

    expect(await apiTokens.listByEvent(event.id)).toEqual([])
    await expect(
      deleteApiToken.execute({ actor: owner, eventId: event.id, apiTokenId: apiToken.id }),
    ).rejects.toEqual(new AppError('API_TOKEN_NOT_FOUND'))
  })

  it('refuses a Viewer with FORBIDDEN', async () => {
    await expect(
      deleteApiToken.execute({ actor: viewer, eventId: event.id, apiTokenId: apiToken.id }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
    expect(await apiTokens.listByEvent(event.id)).toHaveLength(1)
  })
})
