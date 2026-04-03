import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type { ICacheClient } from '../cache';
import type { IRateLimiterConfig } from './IRateLimiterConfig';
import { Logger } from '../logger';

const logger = new Logger('RateLimiter');

export class RateLimiter {
  private readonly limiter: RateLimiterRedis;
  private readonly keyExtractor: (req: Request) => string | null;

  constructor(redis: ICacheClient, config: IRateLimiterConfig) {
    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: config.keyPrefix,
      points: config.points,
      duration: config.duration,
    });
    this.keyExtractor = config.keyExtractor;
  }

  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = this.keyExtractor(req);
    if (!key) {
      next();
      return;
    }

    try {
      const result = await this.limiter.consume(key);
      res.set('X-RateLimit-Remaining', String(result.remainingPoints));
      next();
    } catch (err) {
      logger.warn(`Rate limit exceeded for ${key}`);
      const retryAfter = Math.ceil((err as { msBeforeNext: number }).msBeforeNext / 1000);
      res.set('Retry-After', String(retryAfter));
      res.status(429).json({ status: 'error', code: 'RATE_LIMIT', message: 'Too many requests' });
    }
  };
}
