import { describe, expect, it } from 'vitest'
import { AppError } from '../domain/app-error.js'
import { ParseIdPipe } from './parse-id.pipe.js'

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe()

  it.each([
    ['1', 1],
    ['42', 42],
    ['2147483647', 2147483647],
  ])('turns %j into the id %d', (raw, id) => {
    expect(pipe.transform(raw)).toBe(id)
  })

  it.each(['', 'abc', '0', '-1', '01', '1.5', '1e3', ' 1', '2147483648', '99999999999'])(
    'refuses %j with VALIDATION_ERROR',
    (raw) => {
      expect(() => pipe.transform(raw)).toThrow(new AppError('VALIDATION_ERROR'))
    },
  )
})
