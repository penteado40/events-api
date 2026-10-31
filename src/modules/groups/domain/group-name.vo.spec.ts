import { describe, expect, it } from 'vitest'
import { AppError } from '../../../shared/domain/app-error.js'
import { GroupName } from './group-name.vo.js'

describe('GroupName', () => {
  it('keeps the name trimmed', () => {
    expect(GroupName.create('  Vocal Livre  ').value).toBe('Vocal Livre')
  })

  it.each([[''], ['   '], ['x'.repeat(101)]])('refuses %j with VALIDATION_ERROR', (raw) => {
    expect(() => GroupName.create(raw)).toThrow(new AppError('VALIDATION_ERROR'))
  })

  it('accepts 100 characters', () => {
    expect(GroupName.create('x'.repeat(100)).value).toHaveLength(100)
  })
})
