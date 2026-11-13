import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { UnitOfWork } from '../../shared/application/unit-of-work.js'
import { GroupLookup, GroupsQueriesModule } from '../groups/index.js'
import { GroupDirectory } from './application/ports/group-directory.js'
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js'
import { EditEventUseCase } from './application/use-cases/edit-event.use-case.js'
import { GetEventUseCase } from './application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from './application/use-cases/list-events.use-case.js'
import { ChangeRepository } from './domain/change.repository.js'
import { EventRepository } from './domain/event.repository.js'
import { InProcessGroupDirectory } from './infrastructure/in-process-group-directory.js'
import { PrismaChangeRepository } from './infrastructure/prisma-change.repository.js'
import { PrismaEventRepository } from './infrastructure/prisma-event.repository.js'
import { EventsController } from './presentation/events.controller.js'

/** Composition root of the events context: Events, with where and when, and their Changes. Roles come from groups. */
@Module({
  imports: [GroupsQueriesModule],
  controllers: [EventsController],
  providers: [
    { provide: EventRepository, useClass: PrismaEventRepository },
    { provide: ChangeRepository, useClass: PrismaChangeRepository },
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
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new EditEventUseCase(directory, events, changeLog, unitOfWork, clock),
      inject: [GroupDirectory, EventRepository, ChangeRepository, UnitOfWork, Clock],
    },
  ],
})
export class EventsModule {}
