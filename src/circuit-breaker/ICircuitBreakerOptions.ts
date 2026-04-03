export interface ICircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
}
