import { Logger } from '@nestjs/common'
import { createApp } from './bootstrap.js'
import { AppConfig } from './shared/infrastructure/app-config.js'
import { API_PREFIX } from './shared/presentation/api-prefix.js'

const config = AppConfig.fromEnv()
const app = await createApp(config)
await app.listen(config.port)
Logger.log(`events-api ouvindo em http://localhost:${config.port}/${API_PREFIX}`, 'Bootstrap')
