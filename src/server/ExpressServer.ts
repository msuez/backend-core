import type { Express } from 'express';
import type { Server as HttpServer } from 'http';
import { Logger } from '../logger';

const logger = new Logger('Server');

export class ExpressServer {
  private server: HttpServer | null = null;

  constructor(
    private readonly app: Express,
    private readonly port: number,
  ) {}

  start(): void {
    this.server = this.app.listen(this.port, () => {
      logger.info(`Running on http://localhost:${this.port}`);
    });
  }

  getHttpServer(): HttpServer | null {
    return this.server;
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
