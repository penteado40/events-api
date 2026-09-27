import { type DynamicModule, Global, Module } from '@nestjs/common'
import { AppConfig } from './app-config.js'
import { PrismaService } from './prisma.service.js'

@Global()
@Module({})
export class SharedModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: SharedModule,
      providers: [
        { provide: AppConfig, useValue: config },
        {
          provide: PrismaService,
          useFactory: (c: AppConfig) => new PrismaService(c.databaseUrl),
          inject: [AppConfig],
        },
      ],
      exports: [AppConfig, PrismaService],
    }
  }
}
