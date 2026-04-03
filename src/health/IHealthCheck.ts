export interface IServiceStatus {
  status: 'ok' | 'error';
  message?: string;
}

export interface IHealthCheck {
  name: string;
  check(): Promise<IServiceStatus>;
}
