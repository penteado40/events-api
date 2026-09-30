import { describe, expect, it } from 'vitest'
import { CryptoSecretTokens } from './crypto-secret-tokens.js'

const tokens = new CryptoSecretTokens()

describe('CryptoSecretTokens', () => {
  it('generates a prefixed value with 32 random bytes, different on every call', () => {
    const first = tokens.generate('evt_')
    const second = tokens.generate('evt_')

    expect(first.value).toMatch(/^evt_[A-Za-z0-9_-]{43}$/)
    expect(second.value).not.toBe(first.value)
  })

  it('stores the SHA-256 of the whole value, like the fawedding-api', () => {
    // Known digest of a legacy UUID token (sha256sum of the literal string).
    expect(tokens.hash('3f2b8c1e-7a4d-4e6b-9c0f-1d2e3f4a5b6c')).toBe(
      '63f3cdadbabc2c59e1199f513502351ea3e0541087acdbebeb204008a3517c93',
    )
    const { value, hash } = tokens.generate('evt_')
    expect(hash).toBe(tokens.hash(value))
  })

  it('matches a value against its own hash, and only against it', () => {
    const { value, hash } = tokens.generate('evt_')

    expect(tokens.matches(value, hash)).toBe(true)
    expect(tokens.matches(`${value}x`, hash)).toBe(false)
    expect(tokens.matches(tokens.generate('evt_').value, hash)).toBe(false)
  })

  it('never matches an empty or missing value or hash', () => {
    const emptyHash = tokens.hash('')

    expect(tokens.matches('', emptyHash)).toBe(false)
    expect(tokens.matches(undefined, emptyHash)).toBe(false)
    expect(tokens.matches('abc', '')).toBe(false)
    expect(tokens.matches('abc', undefined)).toBe(false)
    expect(tokens.matches('abc', 'not-hex')).toBe(false)
  })
})
