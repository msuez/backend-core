import { describe, it, expect } from '@jest/globals';
import { CircuitBreakerHealthCheck } from '../../../src/health/checks/CircuitBreakerHealthCheck';
import type { ICircuitBreakerState } from '../../../src/circuit-breaker/ICircuitBreakerState';

class FakeCircuitBreaker implements ICircuitBreakerState {
  constructor(public state: string) {}
}

describe('CircuitBreakerHealthCheck', () => {
  it('returns ok when circuit is closed', async () => {
    const check = new CircuitBreakerHealthCheck(new FakeCircuitBreaker('closed'));
    const result = await check.check();

    expect(result.status).toBe('ok');
    expect(result.message).toBe('closed');
    expect(check.name).toBe('circuitBreaker');
  });

  it('returns ok when circuit is half-open', async () => {
    const check = new CircuitBreakerHealthCheck(new FakeCircuitBreaker('half-open'));
    const result = await check.check();

    expect(result.status).toBe('ok');
    expect(result.message).toBe('half-open');
  });

  it('returns error when circuit is open', async () => {
    const check = new CircuitBreakerHealthCheck(new FakeCircuitBreaker('open'));
    const result = await check.check();

    expect(result.status).toBe('error');
    expect(result.message).toBe('open');
  });
});
