// @ts-expect-error — redlock ESM exports issue
import Redlock from 'redlock';
import type { RedisClient } from '../cache';
import { AppError } from '../errors';
import { Logger } from '../logger';

export class LockService {
  private readonly redlock: Redlock;
  private readonly logger = new Logger('Lock');

  constructor(redis: RedisClient) {
    this.redlock = new Redlock([redis], {
      retryCount: 3,
      retryDelay: 200,
    });
  }

  async withLock<T>(resource: string, fn: () => Promise<T>, ttlMs: number = 5000): Promise<T> {
    let lock;
    try {
      lock = await this.redlock.acquire([`lock:${resource}`], ttlMs);
      this.logger.debug(`Acquired lock: ${resource}`);
    } catch {
      throw new AppError('Resource is locked, try again later', 409, 'CONFLICT');
    }

    try {
      return await fn();
    } finally {
      await lock.release();
      this.logger.debug(`Released lock: ${resource}`);
    }
  }
}
