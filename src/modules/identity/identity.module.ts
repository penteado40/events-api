import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Clock } from '../../shared/application/clock.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { AuthVerifier } from './application/ports/auth-verifier.js'
import { GroupMembers } from './application/ports/group-members.js'
import { IdentityWebhookVerifier } from './application/ports/identity-webhook-verifier.js'
import { InvitationIssuer } from './application/ports/invitation-issuer.js'
import { AuthenticateUseCase } from './application/use-cases/authenticate.use-case.js'
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js'
import { GetMeUseCase } from './application/use-cases/get-me.use-case.js'
import { SyncUserProfileUseCase } from './application/use-cases/sync-user-profile.use-case.js'
import { IssueActivationLinkUseCase } from './application/use-cases/issue-activation-link.use-case.js'
import { UpdateMeUseCase } from './application/use-cases/update-me.use-case.js'
import { ActivationLinkRepository } from './domain/activation-link.repository.js'
import { UserRepository } from './domain/user.repository.js'
import { IdentityInvitationsModule } from './identity-invitations.module.js'
import { IdentityPersistenceModule } from './identity-persistence.module.js'
import { ClerkAuthVerifier } from './infrastructure/clerk-auth-verifier.js'
import { InMemoryGroupMembers } from './infrastructure/in-memory-group-members.js'
import { SvixIdentityWebhookVerifier } from './infrastructure/svix-identity-webhook-verifier.js'
import { ClerkWebhookController } from './presentation/clerk-webhook.controller.js'
import { CredentialsGuard } from './presentation/credentials.guard.js'
import { MeController } from './presentation/me.controller.js'
import { UsersController } from './presentation/users.controller.js'

/**
 * Composition root of the identity context: Users, their Activation links, the
 * global guard that authenticates every request by the Clerk token, and the
 * Clerk webhook that keeps the User mirror in step.
 */
@Module({
  imports: [IdentityPersistenceModule, IdentityInvitationsModule],
  controllers: [MeController, UsersController, ClerkWebhookController],
  providers: [
    { provide: GroupMembers, useClass: InMemoryGroupMembers },
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
        links: ActivationLinkRepository,
        invitations: InvitationIssuer,
        clock: Clock,
      ) => new CreateUserUseCase(users, links, invitations, clock),
      inject: [UserRepository, ActivationLinkRepository, InvitationIssuer, Clock],
    },
    {
      provide: IssueActivationLinkUseCase,
      useFactory: (
        users: UserRepository,
        links: ActivationLinkRepository,
        invitations: InvitationIssuer,
        clock: Clock,
      ) => new IssueActivationLinkUseCase(users, links, invitations, clock),
      inject: [UserRepository, ActivationLinkRepository, InvitationIssuer, Clock],
    },
    {
      provide: GetMeUseCase,
      useFactory: (groupMembers: GroupMembers) => new GetMeUseCase(groupMembers),
      inject: [GroupMembers],
    },
    {
      provide: UpdateMeUseCase,
      useFactory: (users: UserRepository, groupMembers: GroupMembers, clock: Clock) =>
        new UpdateMeUseCase(users, groupMembers, clock),
      inject: [UserRepository, GroupMembers, Clock],
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
export class IdentityModule {}
