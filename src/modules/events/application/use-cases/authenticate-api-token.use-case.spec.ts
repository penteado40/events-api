import { beforeEach, describe, expect, it } from 'vitest'
import { FakeSecretTokens } from '../../../../shared/application/testing/fake-secret-tokens.js'
import { FixedClock } from '../../../../shared/application/testing/fixed-clock.js'
import { AppError } from '../../../../shared/domain/app-error.js'
import type { ApiToken } from '../../domain/api-token.entity.js'
import { newApiTokenProps } from '../testing/api-token-fixtures.js'
import { SUPER_ADMIN_STAMP } from '../testing/event-fixtures.js'
import { InMemoryApiTokenRepository } from '../testing/in-memory-api-token.repository.js'
import { AuthenticateApiTokenUseCase } from './authenticate-api-token.use-case.js'

const VALUE = 'evt_site-value'
const NOW = new Date('2026-09-30T12:00:00.000Z')
const minutesLater = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

describe('AuthenticateApiTokenUseCase', () => {
  let apiTokens: InMemoryApiTokenRepository
  let clock: FixedClock
  let authenticate: AuthenticateApiTokenUseCase
  let apiToken: ApiToken

  beforeEach(async () => {
    apiTokens = new InMemoryApiTokenRepository()
    clock = new FixedClock(NOW)
    const secrets = new FakeSecretTokens()
    authenticate = new AuthenticateApiTokenUseCase(apiTokens, secrets, clock)
    apiToken = await apiTokens.create(
      newApiTokenProps(4, {
        tokenHash: secrets.hash(VALUE),
        scopes: ['event:read', 'rsvp:create'],
      }),
      SUPER_ADMIN_STAMP,
    )
  })

  const stored = async () => (await apiTokens.findInEvent(4, apiToken.id))!

  it('turns an active value into the credential of its Event, with its Scopes', async () => {
    expect(await authenticate.execute({ value: VALUE })).toEqual({
      apiTokenId: apiToken.id,
      eventId: 4,
      scopes: ['event:read', 'rsvp:create'],
    })
  })

  it('refuses an unknown, empty or inactive value alike, with UNAUTHENTICATED', async () => {
    const inactive = await stored()
    inactive.deactivate(SUPER_ADMIN_STAMP)
    await apiTokens.save(inactive)

    for (const value of ['evt_unknown', '', VALUE]) {
      await expect(authenticate.execute({ value })).rejects.toEqual(new AppError('UNAUTHENTICATED'))
    }
  })

  it('stores the last use at most once an hour, without touching the last edit', async () => {
    await authenticate.execute({ value: VALUE })
    expect((await stored()).lastUsedAt).toEqual(NOW)

    clock.set(minutesLater(59))
    await authenticate.execute({ value: VALUE })
    expect((await stored()).lastUsedAt).toEqual(NOW)

    clock.set(minutesLater(60))
    await authenticate.execute({ value: VALUE })
    const afterAnHour = await stored()
    expect(afterAnHour.lastUsedAt).toEqual(minutesLater(60))
    expect(afterAnHour.updatedAt).toEqual(SUPER_ADMIN_STAMP.at)
    expect(afterAnHour.updatedById).toBe(SUPER_ADMIN_STAMP.by)
  })
})
