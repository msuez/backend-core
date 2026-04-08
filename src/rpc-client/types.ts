import type {
  RpcRequest,
  HttpRpcRequest,
  IQueueAdapter,
} from '../rpc';

// ============================================================
// Producer (sending side)
// ============================================================

export interface IProducer {
  send(request: RpcRequest | HttpRpcRequest): Promise<unknown>;
}

// ============================================================
// Configuration
// ============================================================

export type TransportType = 'http' | 'queue';

export interface HttpTransportConfig {
  baseURL: string;
  timeout?: number;
}

export interface QueueTransportConfig {
  adapter: IQueueAdapter;
  queueUrl: string;
  tunneled?: string;
}

export interface ServiceConfig {
  type: TransportType;
  http?: HttpTransportConfig;
  queue?: QueueTransportConfig;
}

export interface RpcModuleConfig {
  services: Record<string, ServiceConfig>;
}
