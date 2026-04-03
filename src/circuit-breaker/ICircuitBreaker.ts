import { ICircuitBreakerState } from './ICircuitBreakerState';

export interface ICircuitBreaker<TArgs extends unknown[], TResult> extends ICircuitBreakerState {
  fire(...args: TArgs): Promise<TResult>;
}
