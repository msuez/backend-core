// @ts-expect-error — redlock ESM exports issue
import Redlock from 'redlock';
import type { RedisClient } from '../cache';
import { AppError } from '../errors';
import { Logger } from '../logger';

const logger = new Logger('Lock');

export class LockService {
  private readonly redlock: Redlock;

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
      logger.debug(`Acquired lock: ${resource}`);
    } catch {
      throw new AppError('Resource is locked, try again later', 409, 'CONFLICT');
    }

    try {
      return await fn();
    } finally {
      await lock.release();
      logger.debug(`Released lock: ${resource}`);
    }
  }
}
