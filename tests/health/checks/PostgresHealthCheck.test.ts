import { describe, it, expect } from '@jest/globals';
import { PostgresHealthCheck, type IQueryExecutor } from '../../../src/health/checks/PostgresHealthCheck';

class FakeQueryExecutor implements IQueryExecutor {
  constructor(private readonly shouldFail: boolean = false) {}

  async query(_query: string): Promise<unknown> {
    if (this.shouldFail) throw new Error('Connection refused');
    return [{ '?column?': 1 }];
  }
}

describe('PostgresHealthCheck', () => {
  it('returns ok when query succeeds', async () => {
    const check = new PostgresHealthCheck(new FakeQueryExecutor());
    const result = await check.check();

    expect(result.status).toBe('ok');
    expect(check.name).toBe('postgres');
  });

  it('returns error when query fails', async () => {
    const check = new PostgresHealthCheck(new FakeQueryExecutor(true));
    const result = await check.check();

    expect(result.status).toBe('error');
    expect(result.message).toBe('Connection refused');
  });
});
