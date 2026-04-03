import type { IHealthCheck, IServiceStatus } from '../IHealthCheck';

export interface IQueryExecutor {
  query(query: string): Promise<unknown>;
}

export class PostgresHealthCheck implements IHealthCheck {
  readonly name = 'postgres';

  constructor(private readonly executor: IQueryExecutor) {}

  async check(): Promise<IServiceStatus> {
    try {
      await this.executor.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
