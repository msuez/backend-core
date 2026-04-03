import type { IClosable } from './IClosable';
import { Logger } from '../logger';

export class GracefulShutdown {
  private shuttingDown = false;
  private readonly logger = new Logger('Shutdown');

  constructor(
    private readonly closables: IClosable[],
    private readonly timeoutMs: number = 10000,
  ) {}

  register(): void {
    const handler = () => this.execute();
    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);
    this.logger.info('Signal handlers registered (SIGTERM, SIGINT)');
  }

  private async execute(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.logger.info('Shutdown initiated...');

    const timeout = setTimeout(() => {
      this.logger.error('Shutdown timed out — forcing exit');
      process.exit(1);
    }, this.timeoutMs);

    try {
      const total = this.closables.length;

      for (let i = 0; i < total; i++) {
        const closable = this.closables[i];
        this.logger.info(`${i + 1}/${total} Closing ${closable.name}...`);
        await closable.close();
      }

      this.logger.info('Shutdown complete');
      clearTimeout(timeout);
      process.exit(0);
    } catch (err) {
      this.logger.error(`Shutdown error: ${err instanceof Error ? err.message : 'Unknown'}`);
      clearTimeout(timeout);
      process.exit(1);
    }
  }
}
