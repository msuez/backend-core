import type { IHealthCheck, IServiceStatus } from './IHealthCheck';
import { Logger } from '../logger';

export interface IHealthResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: Record<string, IServiceStatus>;
}

export class HealthChecker {
  private readonly logger = new Logger('Health');

  constructor(private readonly checks: IHealthCheck[]) {}

  async check(): Promise<{ result: IHealthResult; httpStatus: number }> {
    const results = await Promise.all(
      this.checks.map(async (c) => ({ name: c.name, status: await c.check() })),
    );

    const services: Record<string, IServiceStatus> = {};
    let allOk = true;

    for (const { name, status } of results) {
      services[name] = status;
      if (status.status !== 'ok') allOk = false;
    }

    const result: IHealthResult = {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
    };

    if (!allOk) {
      this.logger.warn('Health check degraded', { services });
    }

    return { result, httpStatus: allOk ? 200 : 503 };
  }
}
