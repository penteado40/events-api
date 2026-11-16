import { type Field, peopleInFields } from '../domain/field.entity.js'
import { type ScheduleField, showField } from '../domain/schedule.js'
import type { UserDirectory } from './ports/user-directory.js'

/** A Field as a write answers it: the Field, and how it is shown, the people of a people Field by name. */
export interface FieldView {
  field: Field
  shown: ScheduleField
}

/** The names of the Users given, by id, asked of identity once; none asked for no one. */
export async function namesOf(
  userIds: readonly number[],
  users: UserDirectory,
): Promise<Map<number, string>> {
  if (userIds.length === 0) return new Map()
  const found = await users.findManyByIds(userIds)
  return new Map(found.map((user) => [user.id, user.name]))
}

/** The Fields given as a write answers them, in the order given, their people by name. */
export async function viewFields(
  fields: readonly Field[],
  users: UserDirectory,
): Promise<FieldView[]> {
  const names = await namesOf(peopleInFields(fields), users)
  return fields.map((field) => ({ field, shown: showField(field.snapshot(), names) }))
}

/** One Field as a write answers it (viewFields). */
export async function viewField(field: Field, users: UserDirectory): Promise<FieldView> {
  const [view] = await viewFields([field], users)
  return view!
}
