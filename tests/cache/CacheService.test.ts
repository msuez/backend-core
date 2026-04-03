import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { CacheService } from '../../src/cache/CacheService';
import type { ICacheClient } from '../../src/cache/ICacheClient';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

class InMemoryCacheClient implements ICacheClient {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _mode: string, _ttl: number): Promise<unknown> {
    this.store.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<string> {
    this.store.clear();
    return 'OK';
  }
}

describe('CacheService', () => {
  let client: InMemoryCacheClient;
  let cache: CacheService;

  beforeEach(() => {
    client = new InMemoryCacheClient();
    cache = new CacheService(client);
  });

  it('returns data and hit=false on MISS', async () => {
    const fetchFn = jest.fn<() => Promise<{ id: number; name: string }>>().mockResolvedValue({ id: 1, name: 'test' });

    const result = await cache.getOrFetch('key:1', 60, fetchFn);

    expect(result.data).toEqual({ id: 1, name: 'test' });
    expect(result.hit).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns cached data and hit=true on HIT', async () => {
    const fetchFn = jest.fn<() => Promise<{ id: number; name: string }>>().mockResolvedValue({ id: 1, name: 'test' });

    await cache.getOrFetch('key:1', 60, fetchFn);
    const result = await cache.getOrFetch('key:1', 60, fetchFn);

    expect(result.data).toEqual({ id: 1, name: 'test' });
    expect(result.hit).toBe(true);
  });

  it('does NOT call fetchFn on HIT', async () => {
    const fetchFn = jest.fn<() => Promise<string>>().mockResolvedValue('data');

    await cache.getOrFetch('key:2', 60, fetchFn);
    await cache.getOrFetch('key:2', 60, fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('del removes keys from cache', async () => {
    const fetchFn = jest.fn<() => Promise<string>>().mockResolvedValue('value');

    await cache.getOrFetch('key:3', 60, fetchFn);
    await cache.del('key:3');

    const result = await cache.getOrFetch('key:3', 60, fetchFn);
    expect(result.hit).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
