import type { ICacheClient } from '../../cache';
import type { IHealthCheck, IServiceStatus } from '../IHealthCheck';

export class RedisHealthCheck implements IHealthCheck {
  readonly name = 'redis';

  constructor(private readonly redis: ICacheClient) {}

  async check(): Promise<IServiceStatus> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? { status: 'ok' } : { status: 'error', message: `Unexpected: ${pong}` };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
