import {
  SQSClient,
  SendMessageCommand,
  type SQSClientConfig,
} from '@aws-sdk/client-sqs';
import type { IQueueAdapter, QueueMessage, QueueSendOptions } from './types';

export interface SqsAdapterConfig {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  clientOptions?: SQSClientConfig;
}

/**
 * SQS queue adapter (Adapter pattern).
 *
 * Adapts AWS SQS SDK v3 to the generic IQueueAdapter interface.
 * Uses lazy initialization for the SQS client.
 */
export class SqsAdapter implements IQueueAdapter {
  private client: SQSClient | null = null;
  private readonly config: SqsAdapterConfig;

  constructor(config: SqsAdapterConfig = {}) {
    this.config = config;
  }

  private getClient(): SQSClient {
    if (!this.client) {
      this.client = new SQSClient({
        region: this.config.region,
        credentials: this.config.credentials,
        ...this.config.clientOptions,
      });
    }
    return this.client;
  }

  async send(
    queueUrl: string,
    body: string,
    options: QueueSendOptions = {},
  ): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: body,
      DelaySeconds: options.delaySeconds ?? 0,
    });

    await this.getClient().send(command);
  }

  async receive(
    _queueUrl: string,
    handler: (messages: QueueMessage[]) => Promise<void>,
  ): Promise<void> {
    this._handler = handler;
  }

  private _handler:
    | ((messages: QueueMessage[]) => Promise<void>)
    | null = null;

  async processRecords(
    records: Array<{ messageId: string; body: string }>,
  ): Promise<void> {
    if (!this._handler) {
      throw new Error(
        'No handler registered. Call receive() before processRecords().',
      );
    }

    const messages: QueueMessage[] = records.map((record) => ({
      id: record.messageId,
      body: record.body,
      raw: record,
    }));

    await this._handler(messages);
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this._handler = null;
  }
}
