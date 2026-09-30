import { Module } from '@nestjs/common'
import { Clock } from '../../shared/application/clock.js'
import { SecretTokens } from '../../shared/application/secret-tokens.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { ApiTokenAuthenticator } from '../../shared/presentation/api-token.js'
import { IdentityAccountsModule, IdentityQueriesModule } from '../identity/index.js'
import { MemberAccounts } from './application/ports/member-accounts.js'
import { UserDirectory } from './application/ports/user-directory.js'
import { AuthenticateApiTokenUseCase } from './application/use-cases/authenticate-api-token.use-case.js'
import { CreateApiTokenUseCase } from './application/use-cases/create-api-token.use-case.js'
import { DeleteApiTokenUseCase } from './application/use-cases/delete-api-token.use-case.js'
import { GetApiTokenUseCase } from './application/use-cases/get-api-token.use-case.js'
import { GetPublicEventUseCase } from './application/use-cases/get-public-event.use-case.js'
import { ListApiTokensUseCase } from './application/use-cases/list-api-tokens.use-case.js'
import { UpdateApiTokenUseCase } from './application/use-cases/update-api-token.use-case.js'
import { AddEventMemberUseCase } from './application/use-cases/add-event-member.use-case.js'
import { ChangeEventMemberRoleUseCase } from './application/use-cases/change-event-member-role.use-case.js'
import { IssueMemberActivationLinkUseCase } from './application/use-cases/issue-member-activation-link.use-case.js'
import { ListEventMembersUseCase } from './application/use-cases/list-event-members.use-case.js'
import { RemoveEventMemberUseCase } from './application/use-cases/remove-event-member.use-case.js'
import { TransferPrimaryOwnerUseCase } from './application/use-cases/transfer-primary-owner.use-case.js'
import { ArchiveEventUseCase } from './application/use-cases/archive-event.use-case.js'
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js'
import { GetEventUseCase } from './application/use-cases/get-event.use-case.js'
import { ListEventsUseCase } from './application/use-cases/list-events.use-case.js'
import { UnarchiveEventUseCase } from './application/use-cases/unarchive-event.use-case.js'
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case.js'
import type { SiteUrlOptions } from './domain/site-url.vo.js'
import { ApiTokenRepository } from './domain/api-token.repository.js'
import { EventRepository } from './domain/event.repository.js'
import { InProcessMemberAccounts } from './infrastructure/in-process-member-accounts.js'
import { InProcessUserDirectory } from './infrastructure/in-process-user-directory.js'
import { PrismaApiTokenRepository } from './infrastructure/prisma-api-token.repository.js'
import { PrismaEventRepository } from './infrastructure/prisma-event.repository.js'
import { SiteApiTokenAuthenticator } from './presentation/site-api-token-authenticator.js'
import { ApiTokensController } from './presentation/api-tokens.controller.js'
import { EventMembersController } from './presentation/event-members.controller.js'
import { EventsController } from './presentation/events.controller.js'

/** Composition root of the events context: Events, members, API tokens and the AccessPolicy. */
@Module({
  imports: [IdentityQueriesModule, IdentityAccountsModule],
  controllers: [EventsController, EventMembersController, ApiTokensController],
  providers: [
    { provide: EventRepository, useClass: PrismaEventRepository },
    { provide: ApiTokenRepository, useClass: PrismaApiTokenRepository },
    { provide: UserDirectory, useClass: InProcessUserDirectory },
    { provide: MemberAccounts, useClass: InProcessMemberAccounts },
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
    {
      provide: ListEventMembersUseCase,
      useFactory: (events: EventRepository, users: UserDirectory) =>
        new ListEventMembersUseCase(events, users),
      inject: [EventRepository, UserDirectory],
    },
    {
      provide: AddEventMemberUseCase,
      useFactory: (events: EventRepository, accounts: MemberAccounts, clock: Clock) =>
        new AddEventMemberUseCase(events, accounts, clock),
      inject: [EventRepository, MemberAccounts, Clock],
    },
    {
      provide: ChangeEventMemberRoleUseCase,
      useFactory: (events: EventRepository, users: UserDirectory, clock: Clock) =>
        new ChangeEventMemberRoleUseCase(events, users, clock),
      inject: [EventRepository, UserDirectory, Clock],
    },
    {
      provide: RemoveEventMemberUseCase,
      useFactory: (events: EventRepository, accounts: MemberAccounts) =>
        new RemoveEventMemberUseCase(events, accounts),
      inject: [EventRepository, MemberAccounts],
    },
    {
      provide: TransferPrimaryOwnerUseCase,
      useFactory: (events: EventRepository, users: UserDirectory, clock: Clock) =>
        new TransferPrimaryOwnerUseCase(events, users, clock),
      inject: [EventRepository, UserDirectory, Clock],
    },
    {
      provide: IssueMemberActivationLinkUseCase,
      useFactory: (events: EventRepository, accounts: MemberAccounts, clock: Clock) =>
        new IssueMemberActivationLinkUseCase(events, accounts, clock),
      inject: [EventRepository, MemberAccounts, Clock],
    },
    {
      provide: GetPublicEventUseCase,
      useFactory: (events: EventRepository) => new GetPublicEventUseCase(events),
      inject: [EventRepository],
    },
    {
      provide: CreateApiTokenUseCase,
      useFactory: (
        events: EventRepository,
        apiTokens: ApiTokenRepository,
        secrets: SecretTokens,
        clock: Clock,
      ) => new CreateApiTokenUseCase(events, apiTokens, secrets, clock),
      inject: [EventRepository, ApiTokenRepository, SecretTokens, Clock],
    },
    {
      provide: ListApiTokensUseCase,
      useFactory: (events: EventRepository, apiTokens: ApiTokenRepository) =>
        new ListApiTokensUseCase(events, apiTokens),
      inject: [EventRepository, ApiTokenRepository],
    },
    {
      provide: GetApiTokenUseCase,
      useFactory: (events: EventRepository, apiTokens: ApiTokenRepository) =>
        new GetApiTokenUseCase(events, apiTokens),
      inject: [EventRepository, ApiTokenRepository],
    },
    {
      provide: UpdateApiTokenUseCase,
      useFactory: (events: EventRepository, apiTokens: ApiTokenRepository, clock: Clock) =>
        new UpdateApiTokenUseCase(events, apiTokens, clock),
      inject: [EventRepository, ApiTokenRepository, Clock],
    },
    {
      provide: DeleteApiTokenUseCase,
      useFactory: (events: EventRepository, apiTokens: ApiTokenRepository) =>
        new DeleteApiTokenUseCase(events, apiTokens),
      inject: [EventRepository, ApiTokenRepository],
    },
    {
      provide: AuthenticateApiTokenUseCase,
      useFactory: (apiTokens: ApiTokenRepository, secrets: SecretTokens, clock: Clock) =>
        new AuthenticateApiTokenUseCase(apiTokens, secrets, clock),
      inject: [ApiTokenRepository, SecretTokens, Clock],
    },
    // The global guard checks the Site's X-Api-Key through it.
    {
      provide: ApiTokenAuthenticator,
      useFactory: (authenticate: AuthenticateApiTokenUseCase) =>
        new SiteApiTokenAuthenticator(authenticate),
      inject: [AuthenticateApiTokenUseCase],
    },
  ],
  exports: [ApiTokenAuthenticator],
})
export class EventsModule {}

/** `http://localhost` Sites are accepted outside production only. */
function siteUrlOptions(config: AppConfig): SiteUrlOptions {
  return { allowLocalhost: !config.isProduction }
}
