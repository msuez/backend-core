import { describe, it, expect, beforeAll } from '@jest/globals';
import { OpossumeCircuitBreaker } from '../../src/circuit-breaker/CircuitBreaker';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

describe('OpossumeCircuitBreaker', () => {
  it('fire() returns result when function succeeds', async () => {
    const fn = async (x: number) => x * 2;
    const breaker = new OpossumeCircuitBreaker(fn, {
      timeout: 100,
      resetTimeout: 100,
      rollingCountTimeout: 100,
    });

    const result = await breaker.fire(5);
    expect(result).toBe(10);
  });

  it('fire() throws when function fails', async () => {
    const fn = async () => {
      throw new Error('boom');
    };
    const breaker = new OpossumeCircuitBreaker(fn, {
      timeout: 100,
      resetTimeout: 100,
      rollingCountTimeout: 100,
    });

    await expect(breaker.fire()).rejects.toThrow('boom');
  });

  it('state is "closed" initially', () => {
    const fn = async () => 'ok';
    const breaker = new OpossumeCircuitBreaker(fn, {
      timeout: 100,
      resetTimeout: 100,
      rollingCountTimeout: 100,
    });

    expect(breaker.state).toBe('closed');
  });
});
