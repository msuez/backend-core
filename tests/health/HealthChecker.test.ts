import { describe, it, expect, beforeAll } from '@jest/globals';
import { HealthChecker } from '../../src/health/HealthChecker';
import type { IHealthCheck, IServiceStatus } from '../../src/health/IHealthCheck';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

class FakeHealthCheck implements IHealthCheck {
  constructor(
    public readonly name: string,
    private readonly result: IServiceStatus,
  ) {}

  async check(): Promise<IServiceStatus> {
    return this.result;
  }
}

describe('HealthChecker', () => {
  it('all checks OK → status "ok", httpStatus 200', async () => {
    const checker = new HealthChecker([
      new FakeHealthCheck('db', { status: 'ok' }),
      new FakeHealthCheck('redis', { status: 'ok' }),
    ]);

    const { result, httpStatus } = await checker.check();

    expect(result.status).toBe('ok');
    expect(httpStatus).toBe(200);
    expect(result.services['db']).toEqual({ status: 'ok' });
    expect(result.services['redis']).toEqual({ status: 'ok' });
  });

  it('one check fails → status "degraded", httpStatus 503', async () => {
    const checker = new HealthChecker([
      new FakeHealthCheck('db', { status: 'ok' }),
      new FakeHealthCheck('redis', { status: 'error', message: 'Connection refused' }),
    ]);

    const { result, httpStatus } = await checker.check();

    expect(result.status).toBe('degraded');
    expect(httpStatus).toBe(503);
  });

  it('services object contains all check names', async () => {
    const checker = new HealthChecker([
      new FakeHealthCheck('postgres', { status: 'ok' }),
      new FakeHealthCheck('redis', { status: 'ok' }),
      new FakeHealthCheck('s3', { status: 'ok' }),
    ]);

    const { result } = await checker.check();

    expect(Object.keys(result.services)).toEqual(['postgres', 'redis', 's3']);
  });
});
