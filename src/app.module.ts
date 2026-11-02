import { type DynamicModule, Module } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'
import { EmailsModule } from './modules/emails/index.js'
import { GroupsModule } from './modules/groups/index.js'
import { IdentityModule } from './modules/identity/index.js'
import { AppConfig } from './shared/infrastructure/app-config.js'
import { SharedModule } from './shared/infrastructure/shared.module.js'
import { AllExceptionsFilter } from './shared/presentation/all-exceptions.filter.js'

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [SharedModule.forRoot(config), IdentityModule, GroupsModule, EmailsModule],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        {
          provide: APP_FILTER,
          useFactory: (c: AppConfig) =>
            new AllExceptionsFilter({ exposeInternalErrors: !c.isProduction }),
          inject: [AppConfig],
        },
      ],
    }
  }
}
