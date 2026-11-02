import { Injectable } from '@nestjs/common'
import { createdWith, type Stamp } from '../../../shared/domain/stamp.js'
import { PrismaService } from '../../../shared/infrastructure/prisma.service.js'
import type { EmailLogEntry } from '../domain/email-log.js'
import { EmailLogRepository } from '../domain/email-log.repository.js'

@Injectable()
export class PrismaEmailLogRepository extends EmailLogRepository {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async record(entry: EmailLogEntry, stamp: Stamp): Promise<void> {
    await this.prisma.emailLog.create({ data: { ...entry, ...createdWith(stamp) } })
  }
}
