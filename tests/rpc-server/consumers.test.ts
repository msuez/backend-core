import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { HttpConsumer } from '../../src/rpc-server/HttpConsumer';
import { QueueConsumer } from '../../src/rpc-server/QueueConsumer';
import type { RpcMessageHandler } from '../../src/rpc-server/types';
import type { IQueueAdapter } from '../../src/rpc/types';

function makeSuccessHandler(): RpcMessageHandler {
  return async (msg) => ({
    body: msg,
    data: { uid: '', succes: true, error: null, result: { handled: msg.cmd } },
  });
}

function makeErrorResultHandler(): RpcMessageHandler {
  return async (msg) => ({
    body: msg,
    data: {
      uid: '', succes: false,
      error: { message: 'Command failed', name: 'TestError', showable: true, internal: false },
      result: undefined as unknown,
    },
  });
}

describe('HttpConsumer', () => {
  let consumer: HttpConsumer;

  beforeEach(() => { consumer = new HttpConsumer(); });

  it('should return 503 if not started', async () => {
    const result = await consumer.handleRequest('{}');
    expect(result.statusCode).toBe(503);
  });

  it('should process a valid HTTP request', async () => {
    await consumer.start(makeSuccessHandler());
    const body = JSON.stringify({ uid: 'req-1', cmd: 'auth:verify', params: ['token-abc'], context: {} });
    const result = await consumer.handleRequest(body);
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.body);
    expect(data.succes).toBe(true);
    expect(data.result.handled).toBe('auth:verify');
  });

  it('should return 500 on invalid JSON', async () => {
    await consumer.start(makeSuccessHandler());
    const result = await consumer.handleRequest('not-json');
    expect(result.statusCode).toBe(500);
  });

  it('should return 500 when handler throws', async () => {
    await consumer.start(async () => { throw new Error('boom'); });
    const result = await consumer.handleRequest(JSON.stringify({ cmd: 'test', params: [], context: {} }));
    expect(result.statusCode).toBe(500);
    const data = JSON.parse(result.body);
    expect(data.message).toBe('boom');
  });

  it('should stop accepting requests after stop()', async () => {
    await consumer.start(makeSuccessHandler());
    await consumer.stop();
    const result = await consumer.handleRequest('{}');
    expect(result.statusCode).toBe(503);
  });
});

describe('QueueConsumer', () => {
  function makeMockAdapter(): IQueueAdapter {
    return {
      send: jest.fn<IQueueAdapter['send']>().mockResolvedValue(undefined),
      receive: jest.fn<IQueueAdapter['receive']>().mockResolvedValue(undefined),
      stop: jest.fn<IQueueAdapter['stop']>().mockResolvedValue(undefined),
    };
  }

  it('should throw if processRecords called before start', async () => {
    const consumer = new QueueConsumer({ adapter: makeMockAdapter(), queueUrl: 'https://sqs.../queue' });
    await expect(consumer.processRecords([{ messageId: '1', body: '{}' }])).rejects.toThrow('Consumer not started');
  });

  it('should process records and return success results', async () => {
    const consumer = new QueueConsumer({ adapter: makeMockAdapter(), queueUrl: 'https://sqs.../queue' });
    await consumer.start(makeSuccessHandler());
    const records = [
      { messageId: 'msg-1', body: JSON.stringify({ cmd: 'mail:send', params: ['u1'], context: {} }) },
      { messageId: 'msg-2', body: JSON.stringify({ cmd: 'mail:send', params: ['u2'], context: {} }) },
    ];
    const results = await consumer.processRecords(records);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ messageId: 'msg-1', success: true });
    expect(results[1]).toEqual({ messageId: 'msg-2', success: true });
  });

  it('should mark failed messages when handler returns error', async () => {
    const consumer = new QueueConsumer({ adapter: makeMockAdapter(), queueUrl: 'https://sqs.../queue' });
    await consumer.start(makeErrorResultHandler());
    const results = await consumer.processRecords([
      { messageId: 'msg-1', body: JSON.stringify({ cmd: 'fail:cmd', params: [], context: {} }) },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Command failed');
  });

  it('should handle thrown errors in handler', async () => {
    const consumer = new QueueConsumer({ adapter: makeMockAdapter(), queueUrl: 'https://sqs.../queue' });
    await consumer.start(async () => { throw new Error('handler crash'); });
    const results = await consumer.processRecords([
      { messageId: 'msg-1', body: JSON.stringify({ cmd: 'crash', params: [], context: {} }) },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('handler crash');
  });

  it('should handle invalid JSON in record body', async () => {
    const consumer = new QueueConsumer({ adapter: makeMockAdapter(), queueUrl: 'https://sqs.../queue' });
    await consumer.start(makeSuccessHandler());
    const results = await consumer.processRecords([{ messageId: 'bad', body: 'not-json' }]);
    expect(results[0].success).toBe(false);
  });

  it('should call adapter.receive on start', async () => {
    const adapter = makeMockAdapter();
    const consumer = new QueueConsumer({ adapter, queueUrl: 'https://sqs.../queue' });
    await consumer.start(makeSuccessHandler());
    expect(adapter.receive).toHaveBeenCalledWith('https://sqs.../queue', expect.any(Function));
  });

  it('should call adapter.stop on stop', async () => {
    const adapter = makeMockAdapter();
    const consumer = new QueueConsumer({ adapter, queueUrl: 'https://sqs.../queue' });
    await consumer.start(makeSuccessHandler());
    await consumer.stop();
    expect(adapter.stop).toHaveBeenCalled();
  });
});
