import { Injectable } from '@nestjs/common'
import { UserLookup } from '../../identity/index.js'
import { type DirectoryUser, UserDirectory } from '../application/ports/user-directory.js'

/** Asks the identity context, which owns Users, through its exported UserLookup. */
@Injectable()
export class InProcessUserDirectory extends UserDirectory {
  constructor(private readonly users: UserLookup) {
    super()
  }

  findById(id: number): Promise<DirectoryUser | null> {
    return this.users.findById(id)
  }

  findManyByIds(ids: number[]): Promise<DirectoryUser[]> {
    return this.users.findManyByIds(ids)
  }
}
