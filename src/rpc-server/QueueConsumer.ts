import type { IConsumer, RpcMessageHandler } from './types';
import type { IQueueAdapter, QueueMessage, RpcRequest } from '../rpc';

export interface QueueConsumerConfig {
  adapter: IQueueAdapter;
  queueUrl: string;
}

export interface QueueRecordResult {
  messageId: string;
  success: boolean;
  error?: string;
}

/**
 * Queue-based consumer.
 *
 * Consumes RPC messages from a queue via a pluggable IQueueAdapter
 * and dispatches them to the RpcServer.
 */
export class QueueConsumer implements IConsumer {
  private handler: RpcMessageHandler | null = null;
  private readonly adapter: IQueueAdapter;
  private readonly queueUrl: string;

  constructor(config: QueueConsumerConfig) {
    this.adapter = config.adapter;
    this.queueUrl = config.queueUrl;
  }

  async start(handler: RpcMessageHandler): Promise<void> {
    this.handler = handler;

    await this.adapter.receive(this.queueUrl, async (messages) => {
      await this.processMessages(messages);
    });
  }

  async stop(): Promise<void> {
    this.handler = null;
    await this.adapter.stop();
  }

  async processRecords(
    records: Array<{ messageId: string; body: string }>,
  ): Promise<QueueRecordResult[]> {
    if (!this.handler) {
      throw new Error('Consumer not started. Call start() first.');
    }

    const messages: QueueMessage[] = records.map((r) => ({
      id: r.messageId,
      body: r.body,
      raw: r,
    }));

    return this.processMessages(messages);
  }

  private async processMessages(
    messages: QueueMessage[],
  ): Promise<QueueRecordResult[]> {
    if (!this.handler) {
      throw new Error('Consumer not started. Call start() first.');
    }

    const handler = this.handler;
    const results: QueueRecordResult[] = [];

    const promises = messages.map(async (msg) => {
      const startedAt = Date.now();
      let cmd = 'Unknown';

      try {
        const message: RpcRequest = JSON.parse(msg.body);
        cmd = message.cmd;

        const result = await handler(message);
        const delta = Date.now() - startedAt;

        if (result.data?.error) {
          results.push({
            messageId: msg.id,
            success: false,
            error: `${result.data.error.message} (${result.data.error.name})`,
          });
          return;
        }

        results.push({ messageId: msg.id, success: true });
      } catch (err) {
        const delta = Date.now() - startedAt;
        const errorMsg =
          err instanceof Error ? err.message : String(err);

        results.push({
          messageId: msg.id,
          success: false,
          error: `${cmd}: ${errorMsg}`,
        });
      }
    });

    await Promise.all(promises);
    return results;
  }
}
