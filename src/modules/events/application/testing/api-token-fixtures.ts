import type { NewApiTokenProps } from '../../domain/api-token.entity.js'

let sequence = 0

/** Valid props for a new API token of the Event; each call gets its own hash. */
export function newApiTokenProps(
  eventId: number,
  overrides: Partial<NewApiTokenProps> = {},
): NewApiTokenProps {
  sequence += 1
  return {
    eventId,
    name: `Site ${sequence}`,
    tokenHash: `hash:evt_fixture-${sequence}`,
    scopes: ['event:read'],
    ...overrides,
  }
}
