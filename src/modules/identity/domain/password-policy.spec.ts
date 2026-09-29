import { describe, expect, it } from 'vitest'
import { PasswordPolicy } from './password-policy.js'

describe('PasswordPolicy', () => {
  it('accepts 8 characters to 72 bytes with an uppercase, a lowercase, a digit and a symbol', () => {
    for (const plain of [
      'Abcdef1!',
      'Admin-local-123',
      'Senha com espaço 1!',
      `Aa1!${'x'.repeat(68)}`, // 72 bytes
      'jOão1!ÉÉ', // non-ASCII is allowed, the ASCII O, j, 1 and ! meet the rule
    ]) {
      expect(PasswordPolicy.isStrong(plain), plain).toBe(true)
    }
  })

  it('accepts any ASCII punctuation as the symbol', () => {
    for (const symbol of '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~') {
      expect(PasswordPolicy.isStrong(`Abcdef1${symbol}`), symbol).toBe(true)
    }
  })

  it('refuses a password that misses any requirement', () => {
    for (const plain of [
      'Abcde1!', // 7 characters
      'Aa1!😀😀', // 6 characters, though 8 UTF-16 code units
      `Aa1!${'x'.repeat(69)}`, // 73 bytes
      'abcdef1!', // no uppercase
      'ABCDEF1!', // no lowercase
      'Abcdefg!', // no digit
      'Abcdefg1', // no symbol
      'Abcd efg1', // a space is not a symbol
      'Abcdefg1€', // € is not ASCII punctuation
      'joão1!ÉÉ', // É is not an ASCII uppercase
      'JOÃO1!éé', // é is not an ASCII lowercase
      'Abcdefg١!', // Arabic-Indic digit is not 0-9
    ]) {
      expect(PasswordPolicy.isStrong(plain), plain).toBe(false)
    }
  })
})
