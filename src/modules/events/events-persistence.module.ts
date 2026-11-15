import { Module } from '@nestjs/common'
import { ParticipantRepository } from './domain/participant.repository.js'
import { PrismaParticipantRepository } from './infrastructure/prisma-participant.repository.js'

/** Internal to events (not in index.ts): binds the repository the main module and the queries share, once. */
@Module({
  providers: [{ provide: ParticipantRepository, useClass: PrismaParticipantRepository }],
  exports: [ParticipantRepository],
})
export class EventsPersistenceModule {}
