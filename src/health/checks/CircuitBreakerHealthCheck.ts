import type { ICircuitBreakerState } from '../../circuit-breaker';
import type { IHealthCheck, IServiceStatus } from '../IHealthCheck';

export class CircuitBreakerHealthCheck implements IHealthCheck {
  readonly name = 'circuitBreaker';

  constructor(private readonly circuitBreaker: ICircuitBreakerState) {}

  async check(): Promise<IServiceStatus> {
    const state = this.circuitBreaker.state;
    return { status: state === 'open' ? 'error' : 'ok', message: state };
  }
}
