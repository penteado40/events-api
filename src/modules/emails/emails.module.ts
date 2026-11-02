import { Module } from '@nestjs/common'
import { BackgroundTasks } from '../../shared/application/background-tasks.js'
import { Clock } from '../../shared/application/clock.js'
import { AppConfig } from '../../shared/infrastructure/app-config.js'
import { AccountEmails } from './application/account-emails.js'
import { EmailSender } from './application/ports/email-sender.js'
import { EmailLogRepository } from './domain/email-log.js'
import { PrismaEmailLogRepository } from './infrastructure/prisma-email-log.repository.js'
import { ResendEmailSender } from './infrastructure/resend-email-sender.js'

/**
 * Composition root of the emails context: the emails other contexts ask for,
 * sent after the response and recorded in the Email log. No routes.
 */
@Module({
  providers: [
    {
      provide: EmailSender,
      useFactory: (config: AppConfig) => new ResendEmailSender(config.resendApiKey),
      inject: [AppConfig],
    },
    { provide: EmailLogRepository, useClass: PrismaEmailLogRepository },
    {
      provide: AccountEmails,
      useFactory: (
        sender: EmailSender,
        log: EmailLogRepository,
        background: BackgroundTasks,
        clock: Clock,
        config: AppConfig,
      ) => new AccountEmails(sender, log, background, clock, config.platformSender),
      inject: [EmailSender, EmailLogRepository, BackgroundTasks, Clock, AppConfig],
    },
  ],
  exports: [AccountEmails],
})
export class EmailsModule {}
