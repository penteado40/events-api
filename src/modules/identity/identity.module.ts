import { type DynamicModule, Module, type Type } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Clock } from '../../shared/application/clock.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { EmailsModule } from '../emails/index.js'
import { ActivationLinkMailer } from './application/ports/activation-link-mailer.js'
import { AuthVerifier } from './application/ports/auth-verifier.js'
import { EventParticipations } from './application/ports/event-participations.js'
import { GroupMembers } from './application/ports/group-members.js'
import { IdentityWebhookVerifier } from './application/ports/identity-webhook-verifier.js'
import { ActivationLinks } from './application/activation-links.js'
import { AuthenticateUseCase } from './application/use-cases/authenticate.use-case.js'
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js'
import { GetMeUseCase } from './application/use-cases/get-me.use-case.js'
import { SyncUserProfileUseCase } from './application/use-cases/sync-user-profile.use-case.js'
import { IssueActivationLinkUseCase } from './application/use-cases/issue-activation-link.use-case.js'
import { UpdateMeUseCase } from './application/use-cases/update-me.use-case.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityInvitationsModule } from './identity-invitations.module.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'
import { ClerkAuthVerifier } from './infrastructure/clerk-auth-verifier.js'
import { InProcessActivationLinkMailer } from './infrastructure/in-process-activation-link-mailer.js'
import { SvixIdentityWebhookVerifier } from './infrastructure/svix-identity-webhook-verifier.js'
import { ClerkWebhookController } from './presentation/clerk-webhook.controller.js'
import { CredentialsGuard } from './presentation/credentials.guard.js'
import { MeController } from './presentation/me.controller.js'
import { UsersController } from './presentation/users.controller.js'

export interface IdentityModuleOptions {
  /**
   * A module that provides and exports GroupMembers. The Membership lives in
   * the groups context, which depends on identity, so identity declares the
   * port and the AppModule hands it the implementation (docs/arquitetura.md §5.5).
   */
  groupMembers: Type | DynamicModule
  /** A module that provides and exports EventParticipations, for the same reason: events depends on identity. */
  eventParticipations: Type | DynamicModule
}

/**
 * Composition root of the identity context: Users, their Activation links, the
 * global guard that authenticates every request by the Clerk token, and the
 * Clerk webhook that keeps the User mirror in step.
 */
@Module({
  imports: [IdentityPersistenceModule, IdentityInvitationsModule, EmailsModule],
  controllers: [MeController, UsersController, ClerkWebhookController],
  providers: [
    { provide: ActivationLinkMailer, useClass: InProcessActivationLinkMailer },
    {
      provide: AuthVerifier,
      useFactory: (config: AppConfig) =>
        new ClerkAuthVerifier({
          secretKey: config.clerkSecretKey,
          jwtKey: config.clerkJwtKey,
          authorizedParties: config.clerkAuthorizedParties,
        }),
      inject: [AppConfig],
    },
    {
      provide: IdentityWebhookVerifier,
      useFactory: (config: AppConfig) =>
        new SvixIdentityWebhookVerifier(config.clerkWebhookSigningSecret),
      inject: [AppConfig],
    },
    {
      provide: SyncUserProfileUseCase,
      useFactory: (users: UserRepository, clock: Clock) => new SyncUserProfileUseCase(users, clock),
      inject: [UserRepository, Clock],
    },
    {
      provide: CreateUserUseCase,
      useFactory: (
        users: UserRepository,
        activationLinks: ActivationLinks,
        mailer: ActivationLinkMailer,
        clock: Clock,
      ) => new CreateUserUseCase(users, activationLinks, mailer, clock),
      inject: [UserRepository, ActivationLinks, ActivationLinkMailer, Clock],
    },
    {
      provide: IssueActivationLinkUseCase,
      useFactory: (activationLinks: ActivationLinks, mailer: ActivationLinkMailer, clock: Clock) =>
        new IssueActivationLinkUseCase(activationLinks, mailer, clock),
      inject: [ActivationLinks, ActivationLinkMailer, Clock],
    },
    {
      provide: GetMeUseCase,
      useFactory: (groupMembers: GroupMembers, participations: EventParticipations) =>
        new GetMeUseCase(groupMembers, participations),
      inject: [GroupMembers, EventParticipations],
    },
    {
      provide: UpdateMeUseCase,
      useFactory: (
        users: UserRepository,
        groupMembers: GroupMembers,
        participations: EventParticipations,
        clock: Clock,
      ) => new UpdateMeUseCase(users, groupMembers, participations, clock),
      inject: [UserRepository, GroupMembers, EventParticipations, Clock],
    },
    {
      provide: AuthenticateUseCase,
      useFactory: (users: UserRepository, verifier: AuthVerifier, clock: Clock) =>
        new AuthenticateUseCase(users, verifier, clock),
      inject: [UserRepository, AuthVerifier, Clock],
    },
    { provide: APP_GUARD, useClass: CredentialsGuard },
  ],
})
export class IdentityModule {
  static forRoot(options: IdentityModuleOptions): DynamicModule {
    return {
      module: IdentityModule,
      imports: [options.groupMembers, options.eventParticipations],
    }
  }
}
