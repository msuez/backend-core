export interface ICacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttl: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
  quit(): Promise<string>;
}
