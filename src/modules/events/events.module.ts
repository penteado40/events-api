import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { UnitOfWork } from '../../shared/application/unit-of-work.js'
import { GroupLookup, GroupsQueriesModule } from '../groups/index.js'
import { IdentityQueriesModule, UserLookup } from '../identity/index.js'
import { EventScheduleReader } from './application/ports/event-schedule-reader.js'
import { GroupDirectory } from './application/ports/group-directory.js'
import { UserDirectory } from './application/ports/user-directory.js'
import { CancelEventItemUseCase } from './application/use-cases/cancel-event-item.use-case.js'
import { CreateEventItemUseCase } from './application/use-cases/create-event-item.use-case.js'
import { CancelEventUseCase } from './application/use-cases/cancel-event.use-case.js'
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js'
import { DeleteEventItemUseCase } from './application/use-cases/delete-event-item.use-case.js'
import { EditEventItemUseCase } from './application/use-cases/edit-event-item.use-case.js'
import { EditEventUseCase } from './application/use-cases/edit-event.use-case.js'
import { GetEventUseCase } from './application/use-cases/get-event.use-case.js'
import { GetScheduleUseCase } from './application/use-cases/get-schedule.use-case.js'
import { ListEventsUseCase } from './application/use-cases/list-events.use-case.js'
import { ListParticipantsUseCase } from './application/use-cases/list-participants.use-case.js'
import { PublishEventItemUseCase } from './application/use-cases/publish-event-item.use-case.js'
import { PublishEventUseCase } from './application/use-cases/publish-event.use-case.js'
import { ReorderEventItemsUseCase } from './application/use-cases/reorder-event-items.use-case.js'
import { UncancelEventItemUseCase } from './application/use-cases/uncancel-event-item.use-case.js'
import { UncancelEventUseCase } from './application/use-cases/uncancel-event.use-case.js'
import { ChangeRepository } from './domain/change.repository.js'
import { EventItemRepository } from './domain/event-item.repository.js'
import { EventRepository } from './domain/event.repository.js'
import { EventsPersistenceModule } from './events-persistence.module.js'
import { ParticipantRepository } from './domain/participant.repository.js'
import { InProcessGroupDirectory } from './infrastructure/in-process-group-directory.js'
import { InProcessUserDirectory } from './infrastructure/in-process-user-directory.js'
import { PrismaChangeRepository } from './infrastructure/prisma-change.repository.js'
import { PrismaEventItemRepository } from './infrastructure/prisma-event-item.repository.js'
import { PrismaEventScheduleReader } from './infrastructure/prisma-event-schedule-reader.js'
import { PrismaEventRepository } from './infrastructure/prisma-event.repository.js'
import { EventItemsController } from './presentation/event-items.controller.js'
import { EventsController } from './presentation/events.controller.js'

/** Composition root of the events context: Events, with where and when, their Participants, their publication, cancel, their Changes and their Event items, with their Draft, their cancel and the order of the production. Roles come from groups; names and phones, from identity. */
@Module({
  imports: [EventsPersistenceModule, GroupsQueriesModule, IdentityQueriesModule],
  controllers: [EventsController, EventItemsController],
  providers: [
    { provide: EventRepository, useClass: PrismaEventRepository },
    { provide: ChangeRepository, useClass: PrismaChangeRepository },
    { provide: EventItemRepository, useClass: PrismaEventItemRepository },
    { provide: EventScheduleReader, useClass: PrismaEventScheduleReader },
    {
      provide: GroupDirectory,
      useFactory: (lookup: GroupLookup) => new InProcessGroupDirectory(lookup),
      inject: [GroupLookup],
    },
    {
      provide: UserDirectory,
      useFactory: (lookup: UserLookup) => new InProcessUserDirectory(lookup),
      inject: [UserLookup],
    },
    {
      provide: CreateEventUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        participants: ParticipantRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new CreateEventUseCase(directory, events, participants, unitOfWork, clock),
      inject: [GroupDirectory, EventRepository, ParticipantRepository, UnitOfWork, Clock],
    },
    {
      provide: ListEventsUseCase,
      useFactory: (directory: GroupDirectory, events: EventRepository, clock: Clock) =>
        new ListEventsUseCase(directory, events, clock),
      inject: [GroupDirectory, EventRepository, Clock],
    },
    {
      provide: GetEventUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        participants: ParticipantRepository,
        clock: Clock,
      ) => new GetEventUseCase(directory, events, participants, clock),
      inject: [GroupDirectory, EventRepository, ParticipantRepository, Clock],
    },
    {
      provide: ListParticipantsUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        participants: ParticipantRepository,
        users: UserDirectory,
      ) => new ListParticipantsUseCase(directory, events, participants, users),
      inject: [GroupDirectory, EventRepository, ParticipantRepository, UserDirectory],
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
    {
      provide: PublishEventUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new PublishEventUseCase(directory, events, changeLog, unitOfWork, clock),
      inject: [GroupDirectory, EventRepository, ChangeRepository, UnitOfWork, Clock],
    },
    {
      provide: CancelEventUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new CancelEventUseCase(directory, events, changeLog, unitOfWork, clock),
      inject: [GroupDirectory, EventRepository, ChangeRepository, UnitOfWork, Clock],
    },
    {
      provide: UncancelEventUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new UncancelEventUseCase(directory, events, changeLog, unitOfWork, clock),
      inject: [GroupDirectory, EventRepository, ChangeRepository, UnitOfWork, Clock],
    },
    {
      provide: CreateEventItemUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        participants: ParticipantRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) =>
        new CreateEventItemUseCase(
          directory,
          events,
          items,
          participants,
          changeLog,
          unitOfWork,
          clock,
        ),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ParticipantRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: EditEventItemUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        participants: ParticipantRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) =>
        new EditEventItemUseCase(
          directory,
          events,
          items,
          participants,
          changeLog,
          unitOfWork,
          clock,
        ),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ParticipantRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: PublishEventItemUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        participants: ParticipantRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) =>
        new PublishEventItemUseCase(
          directory,
          events,
          items,
          participants,
          changeLog,
          unitOfWork,
          clock,
        ),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ParticipantRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: CancelEventItemUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        participants: ParticipantRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) =>
        new CancelEventItemUseCase(
          directory,
          events,
          items,
          participants,
          changeLog,
          unitOfWork,
          clock,
        ),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ParticipantRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: UncancelEventItemUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        participants: ParticipantRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) =>
        new UncancelEventItemUseCase(
          directory,
          events,
          items,
          participants,
          changeLog,
          unitOfWork,
          clock,
        ),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ParticipantRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: DeleteEventItemUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        participants: ParticipantRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) =>
        new DeleteEventItemUseCase(
          directory,
          events,
          items,
          participants,
          changeLog,
          unitOfWork,
          clock,
        ),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ParticipantRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: ReorderEventItemsUseCase,
      useFactory: (
        directory: GroupDirectory,
        events: EventRepository,
        items: EventItemRepository,
        changeLog: ChangeRepository,
        unitOfWork: UnitOfWork,
        clock: Clock,
      ) => new ReorderEventItemsUseCase(directory, events, items, changeLog, unitOfWork, clock),
      inject: [
        GroupDirectory,
        EventRepository,
        EventItemRepository,
        ChangeRepository,
        UnitOfWork,
        Clock,
      ],
    },
    {
      provide: GetScheduleUseCase,
      useFactory: (directory: GroupDirectory, reader: EventScheduleReader) =>
        new GetScheduleUseCase(directory, reader),
      inject: [GroupDirectory, EventScheduleReader],
    },
  ],
})
export class EventsModule {}
