import { Injectable, type PipeTransform } from '@nestjs/common'
import { AppError } from '../domain/app-error.js'

/** The largest id of an autoincrement Int column (Postgres int4). */
const MAX_ID = 2_147_483_647
const DIGITS = /^[1-9]\d*$/

/**
 * A route id (`:id`, `:userId`...): a positive integer within the range of the
 * Int ids, written in plain digits; anything else is 400 VALIDATION_ERROR,
 * before it reaches the database. Unlike ParseIntPipe, it refuses an id too
 * large for the column, which the database would answer with a 500.
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!DIGITS.test(value)) throw new AppError('VALIDATION_ERROR')
    const id = Number(value)
    if (id > MAX_ID) throw new AppError('VALIDATION_ERROR')
    return id
  }
}
