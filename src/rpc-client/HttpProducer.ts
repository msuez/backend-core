import axios, { type AxiosInstance } from 'axios';
import type { IProducer } from './types';
import type { HttpRpcRequest, HttpRpcResponse } from '../rpc';

const HTTP_DEFAULT_TIMEOUT = 30000;

export interface HttpProducerConfig {
  baseURL: string;
  timeout?: number;
}

/**
 * HTTP-based producer (Strategy pattern).
 *
 * Sends RPC requests as HTTP POST to the service endpoint.
 */
export class HttpProducer implements IProducer {
  private readonly instance: AxiosInstance;

  constructor(config: HttpProducerConfig) {
    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? HTTP_DEFAULT_TIMEOUT,
    });
  }

  async send(request: HttpRpcRequest): Promise<HttpRpcResponse> {
    const result = await this.instance.post<HttpRpcResponse>('/', request);
    return result.data;
  }
}
