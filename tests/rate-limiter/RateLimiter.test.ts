import { describe, it, expect } from '@jest/globals';
import { RateLimiter } from '../../src/rate-limiter/RateLimiter';
import type { IRateLimiterConfig } from '../../src/rate-limiter/IRateLimiterConfig';

describe('RateLimiter', () => {
  it('can be imported without errors', () => {
    expect(RateLimiter).toBeDefined();
    expect(typeof RateLimiter).toBe('function');
  });

  it('IRateLimiterConfig shape is correct', () => {
    const config: IRateLimiterConfig = {
      keyPrefix: 'test',
      points: 10,
      duration: 60,
      keyExtractor: (req) => req.ip ?? null,
    };

    expect(config.keyPrefix).toBe('test');
    expect(config.points).toBe(10);
    expect(config.duration).toBe(60);
    expect(typeof config.keyExtractor).toBe('function');
  });

  // Integration tests skipped — RateLimiter requires a real Redis connection
  // via RateLimiterRedis. Use Testcontainers for integration testing.
});
