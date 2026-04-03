import CircuitBreaker from 'opossum';
import type { ICircuitBreaker } from './ICircuitBreaker';
import type { ICircuitBreakerOptions } from './ICircuitBreakerOptions';
import { Logger } from '../logger';
import { AppError } from '../errors';

const logger = new Logger('CircuitBreaker');

const DEFAULTS: Required<ICircuitBreakerOptions> = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
};

export class OpossumeCircuitBreaker<TArgs extends unknown[], TResult> implements ICircuitBreaker<TArgs, TResult> {
  private readonly breaker: CircuitBreaker<TArgs, TResult>;

  constructor(fn: (...args: TArgs) => Promise<TResult>, options?: ICircuitBreakerOptions) {
    const opts = { ...DEFAULTS, ...options };
    this.breaker = new CircuitBreaker(fn, opts);

    this.breaker.on('open', () => logger.warn('Circuit OPEN'));
    this.breaker.on('halfOpen', () => logger.info('Circuit HALF-OPEN'));
    this.breaker.on('close', () => logger.info('Circuit CLOSED'));
  }

  get state(): string {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'half-open';
    return 'closed';
  }

  async fire(...args: TArgs): Promise<TResult> {
    try {
      return await this.breaker.fire(...args);
    } catch (err) {
      if ((err as Error).message?.includes('Breaker is open')) {
        throw new AppError('Circuit breaker is open', 503, 'CIRCUIT_OPEN');
      }
      throw err;
    }
  }
}
