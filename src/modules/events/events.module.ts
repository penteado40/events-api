import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { GroupLookup, GroupsQueriesModule } from '../groups/index.js'
import { GroupDirectory } from './application/ports/group-directory.js'
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js'
import { EditEventUseCase } from './application/use-cases/edit-event.use-case.js'
import { GetEventUseCase } from './application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from './application/use-cases/list-events.use-case.js'
import { EventRepository } from './domain/event.repository.js'
import { InProcessGroupDirectory } from './infrastructure/in-process-group-directory.js'
import { PrismaEventRepository } from './infrastructure/prisma-event.repository.js'
import { EventsController } from './presentation/events.controller.js'

/** Composition root of the events context: Events, with where and when. Roles come from groups. */
@Module({
  imports: [GroupsQueriesModule],
  controllers: [EventsController],
  providers: [
    { provide: EventRepository, useClass: PrismaEventRepository },
    {
      provide: GroupDirectory,
      useFactory: (lookup: GroupLookup) => new InProcessGroupDirectory(lookup),
      inject: [GroupLookup],
    },
    {
      provide: CreateEventUseCase,
      useFactory: (directory: GroupDirectory, events: EventRepository, clock: Clock) =>
        new CreateEventUseCase(directory, events, clock),
      inject: [GroupDirectory, EventRepository, Clock],
    },
    {
      provide: ListEventsUseCase,
      useFactory: (directory: GroupDirectory, events: EventRepository, clock: Clock) =>
        new ListEventsUseCase(directory, events, clock),
      inject: [GroupDirectory, EventRepository, Clock],
    },
    {
      provide: GetEventUseCase,
      useFactory: (directory: GroupDirectory, events: EventRepository, clock: Clock) =>
        new GetEventUseCase(directory, events, clock),
      inject: [GroupDirectory, EventRepository, Clock],
    },
    {
      provide: EditEventUseCase,
      useFactory: (directory: GroupDirectory, events: EventRepository, clock: Clock) =>
        new EditEventUseCase(directory, events, clock),
      inject: [GroupDirectory, EventRepository, Clock],
    },
  ],
})
export class EventsModule {}
