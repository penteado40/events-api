import { Injectable } from '@nestjs/common'
import { Prisma, type User as PrismaUser } from '../../../generated/prisma/client.js'
import { AppError } from '../../../shared/domain/app-error.js'
import { Email } from '../../../shared/domain/email.vo.js'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
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

  async findByClerkId(clerkId: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { clerkId } })
    return row ? toDomain(row) : null
  }

  async findById(id: number): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findManyByIds(ids: number[]): Promise<User[]> {
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids } } })
    return rows.map(toDomain)
  }

  async create(props: NewUserProps, stamp: Stamp): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          name: props.name,
          email: props.email.value,
          role: props.role,
          ...createdWith(stamp),
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
        clerkId: user.clerkId,
        role: user.role,
        updatedAt: user.updatedAt,
        updatedById: user.updatedById,
      },
    })
  }

  async saveClerkLink(user: User): Promise<boolean> {
    try {
      const { count } = await this.prisma.user.updateMany({
        where: { id: user.id, clerkId: null },
        data: { clerkId: user.clerkId, updatedAt: user.updatedAt, updatedById: user.updatedById },
      })
      return count === 1
    } catch (error) {
      // The same Clerk user was linked to another User at the same time.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false
      }
      throw error
    }
  }
}

function toDomain(row: PrismaUser): User {
  return User.restore({
    id: row.id,
    name: row.name,
    email: Email.create(row.email),
    clerkId: row.clerkId,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
    updatedById: row.updatedById,
  })
}
