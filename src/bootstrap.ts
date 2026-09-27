import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { configureApp } from './app.setup.js'
import { AppConfig } from './shared/infrastructure/app-config.js'

export async function createApp(
  config: AppConfig = AppConfig.fromEnv(),
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config))
  configureApp(app, config)
  app.enableShutdownHooks()
  return app
}
