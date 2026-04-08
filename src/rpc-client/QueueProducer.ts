import type { IProducer } from './types';
import type { IQueueAdapter, RpcRequest } from '../rpc';

export interface QueueProducerConfig {
  adapter: IQueueAdapter;
  queueUrl: string;
  delaySeconds?: number;
}

/**
 * Queue-based producer (Strategy pattern).
 *
 * Sends RPC requests to a message queue via a pluggable IQueueAdapter.
 * Fire-and-forget: does not wait for a response.
 */
export class QueueProducer implements IProducer {
  private readonly adapter: IQueueAdapter;
  private readonly queueUrl: string;
  private readonly delaySeconds: number;

  constructor(config: QueueProducerConfig) {
    this.adapter = config.adapter;
    this.queueUrl = config.queueUrl;
    this.delaySeconds = config.delaySeconds ?? 0;
  }

  async send(request: RpcRequest): Promise<void> {
    const body = JSON.stringify(request);
    await this.adapter.send(this.queueUrl, body, {
      delaySeconds: this.delaySeconds,
    });
  }
}
