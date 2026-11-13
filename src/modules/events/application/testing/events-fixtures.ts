import type { ActingUser } from '../actor.js'

export const SUPER_ADMIN: ActingUser = { id: 1, isSuperAdmin: true }
export const ANA: ActingUser = { id: 2, isSuperAdmin: false }

/** The period of the Manaus trip, in the zone of Manaus. */
export const MANAUS_PERIOD = {
  startDate: '2026-11-13',
  endDate: '2026-11-16',
  timezone: 'America/Manaus',
}
