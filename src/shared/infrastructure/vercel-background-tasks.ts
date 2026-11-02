import { Injectable, Logger } from '@nestjs/common'
import { waitUntil } from '@vercel/functions'
import { BackgroundTasks } from '../application/background-tasks.js'

/**
 * Hands each task to Vercel's `waitUntil` (ADR-0007), so the function lives
 * until it ends. Outside Vercel the task just runs. Its error is logged here.
 */
@Injectable()
export class VercelBackgroundTasks extends BackgroundTasks {
  private readonly logger = new Logger('BackgroundTasks')

  run(task: () => Promise<void>): void {
    waitUntil(
      Promise.resolve()
        .then(task)
        .catch((error: unknown) => {
          this.logger.error(
            `Tarefa depois da resposta falhou: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          )
        }),
    )
  }
}
