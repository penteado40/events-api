import { Injectable } from '@nestjs/common'
import { UserLookup } from '../../identity/index.js'
import { type DirectoryUser, UserDirectory } from '../application/ports/user-directory.js'

/** Answers from the identity context, which owns Users. */
@Injectable()
export class IdentityUserDirectory extends UserDirectory {
  constructor(private readonly users: UserLookup) {
    super()
  }

  findById(id: number): Promise<DirectoryUser | null> {
    return this.users.findById(id)
  }
}
