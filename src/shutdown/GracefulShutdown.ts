import type { IClosable } from './IClosable';
import { Logger } from '../logger';

const logger = new Logger('Shutdown');

export class GracefulShutdown {
  private shuttingDown = false;

  constructor(
    private readonly closables: IClosable[],
    private readonly timeoutMs: number = 10000,
  ) {}

  register(): void {
    const handler = () => this.execute();
    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);
    logger.info('Signal handlers registered (SIGTERM, SIGINT)');
  }

  private async execute(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    logger.info('Shutdown initiated...');

    const timeout = setTimeout(() => {
      logger.error('Shutdown timed out — forcing exit');
      process.exit(1);
    }, this.timeoutMs);

    try {
      const total = this.closables.length;

      for (let i = 0; i < total; i++) {
        const closable = this.closables[i];
        logger.info(`${i + 1}/${total} Closing ${closable.name}...`);
        await closable.close();
      }

      logger.info('Shutdown complete');
      clearTimeout(timeout);
      process.exit(0);
    } catch (err) {
      logger.error(`Shutdown error: ${err instanceof Error ? err.message : 'Unknown'}`);
      clearTimeout(timeout);
      process.exit(1);
    }
  }
}
