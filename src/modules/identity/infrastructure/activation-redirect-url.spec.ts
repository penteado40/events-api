import { describe, expect, it } from 'vitest'
import { activationRedirectUrl } from './activation-redirect-url.js'

describe('activationRedirectUrl', () => {
  const base = 'events-expo://activate'

  it('adds inviter, group and name as encoded query parameters', () => {
    expect(
      activationRedirectUrl(base, {
        inviter: 'Bruno Reis',
        group: 'Vocal Livre',
        name: 'Lu Andrade',
      }),
    ).toBe('events-expo://activate?inviter=Bruno%20Reis&group=Vocal%20Livre&name=Lu%20Andrade')
  })

  it('leaves out what is missing or empty', () => {
    expect(activationRedirectUrl(base, { name: 'Lu', group: '' })).toBe(
      'events-expo://activate?name=Lu',
    )
  })

  it('keeps the base as is when there is nothing to add', () => {
    expect(activationRedirectUrl(base, {})).toBe(base)
  })

  it('encodes characters that would break the query', () => {
    expect(activationRedirectUrl(base, { name: 'Zé & Cia = 100%/#1?' })).toBe(
      'events-expo://activate?name=Z%C3%A9%20%26%20Cia%20%3D%20100%25%2F%231%3F',
    )
  })

  it('appends to a base that already has a query', () => {
    expect(activationRedirectUrl('https://app.test/a?x=1', { name: 'Lu' })).toBe(
      'https://app.test/a?x=1&name=Lu',
    )
  })

  it('puts the query before a fragment in the base', () => {
    expect(activationRedirectUrl('https://app.test/a#top', { name: 'Lu' })).toBe(
      'https://app.test/a?name=Lu#top',
    )
  })
})
