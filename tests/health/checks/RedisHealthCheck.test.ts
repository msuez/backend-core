import { describe, it, expect, beforeAll } from '@jest/globals';
import { RedisHealthCheck } from '../../../src/health/checks/RedisHealthCheck';
import type { ICacheClient } from '../../../src/cache/ICacheClient';
import { Logger } from '../../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

class FakeRedisClient implements ICacheClient {
  constructor(private readonly pingResponse: string = 'PONG') {}

  async get(): Promise<string | null> { return null; }
  async set(): Promise<unknown> { return 'OK'; }
  async del(): Promise<number> { return 0; }
  async quit(): Promise<string> { return 'OK'; }

  async ping(): Promise<string> {
    if (this.pingResponse === 'ERROR') throw new Error('Connection refused');
    return this.pingResponse;
  }
}

describe('RedisHealthCheck', () => {
  it('returns ok when ping returns PONG', async () => {
    const check = new RedisHealthCheck(new FakeRedisClient('PONG'));
    const result = await check.check();

    expect(result.status).toBe('ok');
    expect(check.name).toBe('redis');
  });

  it('returns error when ping returns unexpected value', async () => {
    const check = new RedisHealthCheck(new FakeRedisClient('WRONG'));
    const result = await check.check();

    expect(result.status).toBe('error');
    expect(result.message).toContain('Unexpected');
  });

  it('returns error when ping throws', async () => {
    const check = new RedisHealthCheck(new FakeRedisClient('ERROR'));
    const result = await check.check();

    expect(result.status).toBe('error');
    expect(result.message).toBe('Connection refused');
  });
});
