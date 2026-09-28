import { Injectable } from '@nestjs/common'
import { Prisma, type User as PrismaUser } from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { Email } from '../../../shared/domain/email.vo.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import { type NewUserProps, User } from '../domain/user.entity.js'
import { UserRepository } from '../domain/user.repository.js'

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } })
    return row ? toDomain(row) : null
  }

  async findById(id: number): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async create(props: NewUserProps): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          name: props.name,
          email: props.email.value,
          passwordHash: props.passwordHash,
          role: props.role,
        },
      })
      return toDomain(row)
    } catch (error) {
      // The use case checks first; this covers two concurrent creations. The
      // email is the only unique column a new User can collide on.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('EMAIL_ALREADY_IN_USE')
      }
      throw error
    }
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name,
        email: user.email.value,
        passwordHash: user.passwordHash,
        role: user.role,
        passwordChangedAt: user.passwordChangedAt,
      },
    })
  }
}

function toDomain(row: PrismaUser): User {
  return User.restore({
    id: row.id,
    name: row.name,
    email: Email.create(row.email),
    passwordHash: row.passwordHash,
    role: row.role,
    passwordChangedAt: row.passwordChangedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}
