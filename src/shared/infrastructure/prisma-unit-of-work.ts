import { AsyncLocalStorage } from 'node:async_hooks'
import type { Prisma } from '../../generated/prisma/client.js'
import { UnitOfWork } from '../application/unit-of-work.js'
import type { PrismaService } from './prisma.service.js'

/**
 * A unit of work is one interactive Prisma transaction. The repositories write
 * through `client`, which is the transaction of the running unit, so they keep
 * their signatures and join it without receiving it.
 */
export class PrismaUnitOfWork extends UnitOfWork {
  private readonly current = new AsyncLocalStorage<Prisma.TransactionClient>()

  constructor(private readonly prisma: PrismaService) {
    super()
  }

  /** The transaction of the running unit, or the plain client outside one. */
  get client(): Prisma.TransactionClient {
    return this.current.getStore() ?? this.prisma
  }

  /** The transaction of the running unit; fails outside one, where a lock would not hold. */
  transaction(): Prisma.TransactionClient {
    const tx = this.current.getStore()
    if (!tx) throw new Error('Esta leitura trava linhas e precisa rodar dentro de UnitOfWork.run')
    return tx
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.current.getStore()) return work()
    return this.prisma.$transaction((tx) => this.current.run(tx, work))
  }
}
