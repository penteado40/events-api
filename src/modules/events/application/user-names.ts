import type { UserDirectory } from './ports/user-directory.js'

/** The names of the Users given, by id, asked of identity once; none asked for no one. */
export async function namesOf(
  userIds: readonly number[],
  users: UserDirectory,
): Promise<Map<number, string>> {
  if (userIds.length === 0) return new Map()
  const found = await users.findManyByIds(userIds)
  return new Map(found.map((user) => [user.id, user.name]))
}
