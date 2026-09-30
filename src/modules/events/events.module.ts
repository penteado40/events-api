import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { IdentityQueriesModule } from '../identity/index.js'
import { UserDirectory } from './application/ports/user-directory.js'
import { ArchiveEventUseCase } from './application/use-cases/archive-event.use-case.js'
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js'
import { GetEventUseCase } from './application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from './application/use-cases/list-events.use-case.js'
import { UnarchiveEventUseCase } from './application/use-cases/unarchive-event.use-case.js'
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case.js'
import type { SiteUrlOptions } from './domain/site-url.vo.js'
import { EventRepository } from './domain/event.repository.js'
import { InProcessUserDirectory } from './infrastructure/in-process-user-directory.js'
import { PrismaEventRepository } from './infrastructure/prisma-event.repository.js'
import { EventsController } from './presentation/events.controller.js'

/** Composition root of the events context: Events, members and the AccessPolicy. */
@Module({
  imports: [IdentityQueriesModule],
  controllers: [EventsController],
  providers: [
    { provide: EventRepository, useClass: PrismaEventRepository },
    { provide: UserDirectory, useClass: InProcessUserDirectory },
    {
      provide: CreateEventUseCase,
      useFactory: (
        events: EventRepository,
        users: UserDirectory,
        clock: Clock,
        config: AppConfig,
      ) => new CreateEventUseCase(events, users, clock, siteUrlOptions(config)),
      inject: [EventRepository, UserDirectory, Clock, AppConfig],
    },
    {
      provide: ListEventsUseCase,
      useFactory: (events: EventRepository) => new ListEventsUseCase(events),
      inject: [EventRepository],
    },
    {
      provide: GetEventUseCase,
      useFactory: (events: EventRepository) => new GetEventUseCase(events),
      inject: [EventRepository],
    },
    {
      provide: UpdateEventUseCase,
      useFactory: (events: EventRepository, clock: Clock, config: AppConfig) =>
        new UpdateEventUseCase(events, clock, siteUrlOptions(config)),
      inject: [EventRepository, Clock, AppConfig],
    },
    {
      provide: ArchiveEventUseCase,
      useFactory: (events: EventRepository, clock: Clock) => new ArchiveEventUseCase(events, clock),
      inject: [EventRepository, Clock],
    },
    {
      provide: UnarchiveEventUseCase,
      useFactory: (events: EventRepository, clock: Clock) =>
        new UnarchiveEventUseCase(events, clock),
      inject: [EventRepository, Clock],
    },
  ],
})
export class EventsModule {}

/** `http://localhost` Sites are accepted outside production only. */
function siteUrlOptions(config: AppConfig): SiteUrlOptions {
  return { allowLocalhost: !config.isProduction }
}
