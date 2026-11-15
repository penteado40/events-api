import { Module } from '@nestjs/common'
import { EventParticipations } from '../identity/index.js'
import { ParticipationLookup } from './application/participation-lookup.js'
import { ParticipantRepository } from './domain/participant.repository.js'
import { EventsPersistenceModule } from './events-persistence.module.js'

/**
 * The read-only queries the events context offers other contexts: the Events
 * a User is a Participant of, bound to identity's EventParticipations port.
 * Static and without controllers; the AppModule hands it to
 * IdentityModule.forRoot, so identity never imports events (which already
 * depends on identity).
 */
@Module({
  imports: [EventsPersistenceModule],
  providers: [
    {
      provide: EventParticipations,
      useFactory: (participants: ParticipantRepository) => new ParticipationLookup(participants),
      inject: [ParticipantRepository],
    },
  ],
  exports: [EventParticipations],
})
export class EventsQueriesModule {}
