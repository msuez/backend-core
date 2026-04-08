import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockSend = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({});
const mockDestroy = jest.fn();

jest.unstable_mockModule('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
    destroy: mockDestroy,
  })),
  SendMessageCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');
const { SqsAdapter } = await import('../../src/rpc/SqsAdapter');

describe('SqsAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should create SQSClient lazily on first send', async () => {
      const adapter = new SqsAdapter({ region: 'us-east-1' });

      await adapter.send('https://sqs.../queue', '{"cmd":"test"}');

      expect(SQSClient).toHaveBeenCalledTimes(1);
      expect(SQSClient).toHaveBeenCalledWith(
        expect.objectContaining({ region: 'us-east-1' }),
      );
    });

    it('should reuse SQSClient on subsequent sends', async () => {
      const adapter = new SqsAdapter();

      await adapter.send('q', 'body1');
      await adapter.send('q', 'body2');

      expect(SQSClient).toHaveBeenCalledTimes(1);
    });

    it('should send a SendMessageCommand with correct params', async () => {
      const adapter = new SqsAdapter();

      await adapter.send('https://sqs.../my-queue', '{"cmd":"hello"}', {
        delaySeconds: 5,
      });

      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.../my-queue',
        MessageBody: '{"cmd":"hello"}',
        DelaySeconds: 5,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should default delaySeconds to 0', async () => {
      const adapter = new SqsAdapter();

      await adapter.send('q', 'body');

      expect(SendMessageCommand).toHaveBeenCalledWith(
        expect.objectContaining({ DelaySeconds: 0 }),
      );
    });

    it('should pass credentials when provided', async () => {
      const adapter = new SqsAdapter({
        credentials: {
          accessKeyId: 'AKID',
          secretAccessKey: 'SECRET',
        },
      });

      await adapter.send('q', 'body');

      expect(SQSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: {
            accessKeyId: 'AKID',
            secretAccessKey: 'SECRET',
          },
        }),
      );
    });
  });

  describe('processRecords', () => {
    it('should throw if no handler is registered', async () => {
      const adapter = new SqsAdapter();

      await expect(
        adapter.processRecords([{ messageId: '1', body: '{}' }]),
      ).rejects.toThrow('No handler registered');
    });

    it('should process records through the registered handler', async () => {
      const adapter = new SqsAdapter();
      const messages: any[] = [];

      await adapter.receive('q', async (msgs) => {
        messages.push(...msgs);
      });

      await adapter.processRecords([
        { messageId: 'msg-1', body: '{"cmd":"test"}' },
        { messageId: 'msg-2', body: '{"cmd":"test2"}' },
      ]);

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].body).toBe('{"cmd":"test"}');
      expect(messages[1].id).toBe('msg-2');
    });

    it('should include raw record in QueueMessage', async () => {
      const adapter = new SqsAdapter();
      let received: any;

      await adapter.receive('q', async (msgs) => {
        received = msgs[0];
      });

      const rawRecord = { messageId: 'r1', body: '{}' };
      await adapter.processRecords([rawRecord]);

      expect(received.raw).toBe(rawRecord);
    });
  });

  describe('stop', () => {
    it('should destroy the SQS client', async () => {
      const adapter = new SqsAdapter();

      await adapter.send('q', 'body');
      await adapter.stop();

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should clear the handler', async () => {
      const adapter = new SqsAdapter();

      await adapter.receive('q', async () => {});
      await adapter.stop();

      await expect(
        adapter.processRecords([{ messageId: '1', body: '{}' }]),
      ).rejects.toThrow('No handler registered');
    });

    it('should be safe to call without a client', async () => {
      const adapter = new SqsAdapter();
      await expect(adapter.stop()).resolves.toBeUndefined();
    });
  });
});
