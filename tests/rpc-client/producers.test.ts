import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { QueueProducer } from '../../src/rpc-client/QueueProducer';
import type { IQueueAdapter } from '../../src/rpc/types';
import type { HttpRpcRequest, RpcRequest } from '../../src/rpc/types';

jest.unstable_mockModule('axios', () => ({
  default: {
    create: jest.fn(() => ({
      post: jest.fn(),
    })),
  },
}));

const { default: axios } = await import('axios');
const { HttpProducer } = await import('../../src/rpc-client/HttpProducer');

describe('HttpProducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an axios instance with baseURL and default timeout', () => {
    new HttpProducer({ baseURL: 'https://api.example.com' });
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com', timeout: 30000,
    });
  });

  it('should use custom timeout when provided', () => {
    new HttpProducer({ baseURL: 'https://api.example.com', timeout: 5000 });
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com', timeout: 5000,
    });
  });

  it('should POST to / with the request payload', async () => {
    const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      data: { uid: '123', succes: true, error: null, result: 'ok' },
    });
    (axios.create as jest.Mock).mockReturnValue({ post: mockPost });

    const producer = new HttpProducer({ baseURL: 'https://api.example.com' });
    const request: HttpRpcRequest = {
      uid: '123', cmd: 'test:cmd', params: [1, 'two'], context: { userId: 'u1' },
    };

    const result = await producer.send(request);
    expect(mockPost).toHaveBeenCalledWith('/', request);
    expect(result).toEqual({ uid: '123', succes: true, error: null, result: 'ok' });
  });

  it('should propagate axios errors', async () => {
    const mockPost = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockRejectedValue(new Error('Network Error'));
    (axios.create as jest.Mock).mockReturnValue({ post: mockPost });

    const producer = new HttpProducer({ baseURL: 'https://api.example.com' });
    await expect(
      producer.send({ uid: '1', cmd: 'fail', params: [], context: {} }),
    ).rejects.toThrow('Network Error');
  });
});

describe('QueueProducer', () => {
  it('should send serialized message to the adapter', async () => {
    const mockAdapter: IQueueAdapter = {
      send: jest.fn<IQueueAdapter['send']>().mockResolvedValue(undefined),
      receive: jest.fn<IQueueAdapter['receive']>().mockResolvedValue(undefined),
      stop: jest.fn<IQueueAdapter['stop']>().mockResolvedValue(undefined),
    };

    const producer = new QueueProducer({ adapter: mockAdapter, queueUrl: 'https://sqs.../my-queue' });
    const request: RpcRequest = { cmd: 'mailer:send', params: ['user-1'], context: { source: 'api' } };

    await producer.send(request);
    expect(mockAdapter.send).toHaveBeenCalledWith(
      'https://sqs.../my-queue', JSON.stringify(request), { delaySeconds: 0 },
    );
  });

  it('should use custom delaySeconds', async () => {
    const mockAdapter: IQueueAdapter = {
      send: jest.fn<IQueueAdapter['send']>().mockResolvedValue(undefined),
      receive: jest.fn<IQueueAdapter['receive']>().mockResolvedValue(undefined),
      stop: jest.fn<IQueueAdapter['stop']>().mockResolvedValue(undefined),
    };

    const producer = new QueueProducer({ adapter: mockAdapter, queueUrl: 'https://sqs.../my-queue', delaySeconds: 10 });
    await producer.send({ cmd: 'test', params: [], context: {} });

    expect(mockAdapter.send).toHaveBeenCalledWith(
      'https://sqs.../my-queue', expect.any(String), { delaySeconds: 10 },
    );
  });

  it('should propagate adapter errors', async () => {
    const mockAdapter: IQueueAdapter = {
      send: jest.fn<IQueueAdapter['send']>().mockRejectedValue(new Error('Queue unavailable')),
      receive: jest.fn<IQueueAdapter['receive']>().mockResolvedValue(undefined),
      stop: jest.fn<IQueueAdapter['stop']>().mockResolvedValue(undefined),
    };

    const producer = new QueueProducer({ adapter: mockAdapter, queueUrl: 'https://sqs.../my-queue' });
    await expect(
      producer.send({ cmd: 'fail', params: [], context: {} }),
    ).rejects.toThrow('Queue unavailable');
  });
});
