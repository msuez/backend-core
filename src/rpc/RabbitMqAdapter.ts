import amqplib, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import type { IQueueAdapter, QueueMessage, QueueSendOptions } from './types';

export interface RabbitMqAdapterConfig {
  url: string;
}

/**
 * Adapter pattern: adapts amqplib to the IQueueAdapter interface.
 *
 * - send(): publishes a message to a RabbitMQ queue.
 * - receive(): sets up a persistent consumer via channel.consume().
 * - stop(): closes channel and connection.
 */
export class RabbitMqAdapter implements IQueueAdapter {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly url: string;

  constructor(config: RabbitMqAdapterConfig) {
    this.url = config.url;
  }

  private async getChannel(): Promise<Channel> {
    if (!this.channel) {
      this.connection = await amqplib.connect(this.url);
      this.channel = await this.connection.createChannel();
    }
    return this.channel;
  }

  async send(
    queueUrl: string,
    body: string,
    _options?: QueueSendOptions,
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertQueue(queueUrl, { durable: true });
    channel.sendToQueue(queueUrl, Buffer.from(body), { persistent: true });
  }

  async receive(
    queueUrl: string,
    handler: (messages: QueueMessage[]) => Promise<void>,
  ): Promise<void> {
    const channel = await this.getChannel();
    await channel.assertQueue(queueUrl, { durable: true });
    await channel.prefetch(1);

    await channel.consume(queueUrl, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const queueMessage: QueueMessage = {
        id: msg.properties.messageId ?? String(msg.fields.deliveryTag),
        body: msg.content.toString(),
        raw: msg,
      };

      try {
        await handler([queueMessage]);
        channel.ack(msg);
      } catch {
        channel.nack(msg, false, false);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
