import type { Email } from '../../../shared/domain/email.vo.js'
import type { Stamp } from '../../../shared/domain/stamp.js'
import type { NewUserProps, User } from './user.entity.js'

export abstract class UserRepository {
  abstract findByEmail(email: Email): Promise<User | null>
  abstract findById(id: number): Promise<User | null>
  abstract create(props: NewUserProps, stamp: Stamp): Promise<User>
  abstract save(user: User): Promise<void>
}
