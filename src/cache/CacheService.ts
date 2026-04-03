import type { ICacheClient } from './ICacheClient';
import type { ICacheResult } from './ICacheResult';
import { Logger } from '../logger';

export class CacheService {
  private readonly logger = new Logger('Cache');

  constructor(private readonly client: ICacheClient) {}

  async getOrFetch<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<ICacheResult<T>> {
    const cached = await this.client.get(key);

    if (cached) {
      this.logger.debug(`HIT ${key}`);
      return { data: JSON.parse(cached) as T, hit: true };
    }

    this.logger.debug(`MISS ${key}`);
    const data = await fetchFn();
    await this.client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    return { data, hit: false };
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
