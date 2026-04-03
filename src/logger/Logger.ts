import pino from 'pino';
import type { ILoggerConfig } from './ILoggerConfig';

let rootLogger: pino.Logger;

function getRootLogger(): pino.Logger {
  if (!rootLogger) {
    rootLogger = pino({ level: 'info' });
  }
  return rootLogger;
}

export class Logger {
  private readonly child: pino.Logger;

  static init(config: ILoggerConfig = {}): void {
    const { isDev = false, level = 'debug' } = config;
    rootLogger = pino({
      transport: isDev ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname', messageFormat: '{msg}' },
      } : undefined,
      level,
    });
  }

  constructor(private readonly context: string) {
    this.child = getRootLogger().child({ context });
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.child.info(data ?? {}, `[${this.context}] ${msg}`);
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.child.debug(data ?? {}, `[${this.context}] ${msg}`);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.child.warn(data ?? {}, `[${this.context}] ${msg}`);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.child.error(data ?? {}, `[${this.context}] ${msg}`);
  }
}
