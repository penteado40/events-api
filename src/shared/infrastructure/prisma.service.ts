import type { OnModuleDestroy } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.js'

export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(databaseUrl: string) {
    super({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
