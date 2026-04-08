import { v4 as uuid } from 'uuid';
import type { IProducer, TransportType } from './types';
import type { ContextProvider, ContextValue, HttpRpcResponse } from '../rpc';
import { RpcRemoteError } from './RpcRemoteError';

/**
 * Unified RPC client for both HTTP (sync) and Queue (fire-and-forget) communication.
 *
 * - HTTP mode: sends request with uid, waits for response, throws RpcRemoteError on error.
 * - Queue mode: sends request without uid, returns immediately (fire-and-forget).
 */
export class RpcClient {
  public readonly serviceName: string;
  private readonly producer: IProducer;
  private readonly type: TransportType;
  private readonly contextProvider: ContextProvider;

  constructor(
    serviceName: string,
    producer: IProducer,
    type: TransportType,
    contextProvider: ContextProvider = {},
  ) {
    this.serviceName = serviceName;
    this.producer = producer;
    this.type = type;
    this.contextProvider = contextProvider;
  }

  async execute(cmd: string, ...params: unknown[]): Promise<unknown> {
    const context = await this.resolveContext();

    const payload = this.type === 'http'
      ? { uid: uuid(), cmd, params, context }
      : { cmd, params, context };

    const raw = await this.producer.send(payload);

    if (this.type === 'queue') return;

    const data = raw as HttpRpcResponse;
    if (data.error) throw new RpcRemoteError(data.error);
    return data.result;
  }

  private async resolveContext(): Promise<ContextValue> {
    const value = typeof this.contextProvider === 'function'
      ? this.contextProvider()
      : this.contextProvider;
    return Promise.resolve(value);
  }
}
