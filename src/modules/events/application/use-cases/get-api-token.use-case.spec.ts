import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { Event } from '../../domain/event.entity.js'
import { newApiTokenProps } from '../testing/api-token-fixtures.js'
import { newEventProps, SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryApiTokenRepository } from '../testing/in-memory-api-token.repository.js'
import { InMemoryEventRepository } from '../testing/in-memory-event.repository.js'
import { GetApiTokenUseCase } from './get-api-token.use-case.js'

const owner = { id: 10, isSuperAdmin: false }
const manager = { id: 11, isSuperAdmin: false }

describe('GetApiTokenUseCase', () => {
  let events: InMemoryEventRepository
  let apiTokens: InMemoryApiTokenRepository
  let getApiToken: GetApiTokenUseCase
  let event: Event

  beforeEach(async () => {
    events = new InMemoryEventRepository()
    apiTokens = new InMemoryApiTokenRepository()
    getApiToken = new GetApiTokenUseCase(events, apiTokens)
    event = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    events.addMember(event.id, 11, { role: 'MANAGER', isPrimaryOwner: false })
  })

  it('shows an Owner one token of the Event', async () => {
    const created = await apiTokens.create(
      newApiTokenProps(event.id, { name: 'Site' }),
      SUPER_ADMIN_STAMP,
    )

    const apiToken = await getApiToken.execute({
      actor: owner,
      eventId: event.id,
      apiTokenId: created.id,
    })
    expect(apiToken.name).toBe('Site')
  })

  it("answers API_TOKEN_NOT_FOUND for another Event's token or a missing one", async () => {
    const other = await events.create(newEventProps(), 10, SUPER_ADMIN_STAMP)
    const foreign = await apiTokens.create(newApiTokenProps(other.id), SUPER_ADMIN_STAMP)

    for (const apiTokenId of [foreign.id, 999]) {
      await expect(
        getApiToken.execute({ actor: owner, eventId: event.id, apiTokenId }),
      ).rejects.toEqual(new AppError('API_TOKEN_NOT_FOUND'))
    }
  })

  it('refuses a Manager with FORBIDDEN before looking for the token', async () => {
    await expect(
      getApiToken.execute({ actor: manager, eventId: event.id, apiTokenId: 999 }),
    ).rejects.toEqual(new AppError('FORBIDDEN'))
  })
})
