import type { IConsumer, RpcMessageHandler } from './types';
import type { RpcRequest } from '../rpc';

export interface HttpResponse {
  statusCode: number;
  body: string;
}

/**
 * HTTP-based consumer.
 *
 * Adapts incoming HTTP requests (from Lambda, Express, Fastify, etc.)
 * to the RpcServer's executeCommand interface.
 */
export class HttpConsumer implements IConsumer {
  private handler: RpcMessageHandler | null = null;

  async start(handler: RpcMessageHandler): Promise<void> {
    this.handler = handler;
  }

  async stop(): Promise<void> {
    this.handler = null;
  }

  async handleRequest(httpBody: string): Promise<HttpResponse> {
    if (!this.handler) {
      return {
        statusCode: 503,
        body: JSON.stringify({ message: 'Consumer not started' }),
      };
    }

    try {
      const body: RpcRequest = JSON.parse(httpBody);
      const result = await this.handler(body);

      return {
        statusCode: 200,
        body: JSON.stringify(result.data),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Internal server error';

      return {
        statusCode: 500,
        body: JSON.stringify({ message }),
      };
    }
  }
}
