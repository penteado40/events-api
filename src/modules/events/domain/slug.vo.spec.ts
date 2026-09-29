import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { Slug } from './slug.vo.js'

describe('Slug', () => {
  it('accepts kebab-case ASCII between 3 and 60 characters', () => {
    for (const value of ['abc', 'casamento-ana-e-joao', 'evento-2027', 'a'.repeat(60)]) {
      expect(Slug.create(value).value).toBe(value)
    }
  })

  it('is equal to another Slug with the same value', () => {
    expect(Slug.create('casamento').equals(Slug.restore('casamento'))).toBe(true)
    expect(Slug.create('casamento').equals(Slug.create('aniversario'))).toBe(false)
  })

  it('refuses anything else with VALIDATION_ERROR', () => {
    for (const value of [
      'ab',
      'a'.repeat(61),
      'Casamento',
      'com espaço',
      'aniversário',
      '-inicio',
      'fim-',
      'duplo--hifen',
      'under_score',
    ]) {
      expect(() => Slug.create(value), value).toThrow(new AppError('VALIDATION_ERROR'))
    }
  })
})
