import { jest, describe, it, expect, afterEach } from '@jest/globals';
import type { IQueueAdapter } from '../../src/rpc/types';
import type { RpcModuleConfig } from '../../src/rpc-client/types';

jest.unstable_mockModule('axios', () => ({
  default: {
    create: jest.fn(() => ({
      post: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
        data: { uid: '1', succes: true, error: null, result: 'ok' },
      }),
    })),
  },
}));

const { RpcClientFactory } = await import('../../src/rpc-client/RpcClientFactory');
const { ServiceRegistry } = await import('../../src/rpc-client/ServiceRegistry');
const { RpcClient } = await import('../../src/rpc-client/RpcClient');

function mockAdapter(): IQueueAdapter {
  return {
    send: jest.fn<IQueueAdapter['send']>().mockResolvedValue(undefined),
    receive: jest.fn<IQueueAdapter['receive']>().mockResolvedValue(undefined),
    stop: jest.fn<IQueueAdapter['stop']>().mockResolvedValue(undefined),
  };
}

function makeConfig(adapter: IQueueAdapter): RpcModuleConfig {
  return {
    services: {
      auth: { type: 'http', http: { baseURL: 'https://auth.api.com' } },
      mailer: { type: 'queue', queue: { adapter, queueUrl: 'https://sqs.../mailer-queue' } },
      stats: { type: 'queue', queue: { adapter, queueUrl: '', tunneled: 'auth' } },
    },
  };
}

describe('RpcClientFactory', () => {
  it('should create RpcClient for http type', () => {
    const client = RpcClientFactory.create('auth', {
      type: 'http', http: { baseURL: 'https://auth.api.com' },
    });
    expect(client).toBeInstanceOf(RpcClient);
    expect(client.serviceName).toBe('auth');
  });

  it('should create RpcClient for queue type', () => {
    const adapter = mockAdapter();
    const client = RpcClientFactory.create('mailer', {
      type: 'queue', queue: { adapter, queueUrl: 'https://sqs.../queue' },
    });
    expect(client).toBeInstanceOf(RpcClient);
    expect(client.serviceName).toBe('mailer');
  });

  it('should create RpcClient for tunneled queue service', () => {
    const adapter = mockAdapter();
    const config = makeConfig(adapter);
    const client = RpcClientFactory.create('stats', config.services.stats, config);
    expect(client).toBeInstanceOf(RpcClient);
  });

  it('should throw for http type without http config', () => {
    expect(() => RpcClientFactory.create('bad', { type: 'http' })).toThrow('no http config');
  });

  it('should throw for queue type without queue config', () => {
    expect(() => RpcClientFactory.create('bad', { type: 'queue' })).toThrow('no queue config');
  });

  it('should throw for unknown transport type', () => {
    expect(() => RpcClientFactory.create('bad', { type: 'grpc' as any })).toThrow('unknown transport type');
  });
});

describe('ServiceRegistry', () => {
  afterEach(() => { ServiceRegistry.clear(); });

  it('should throw if not configured', () => {
    expect(() => ServiceRegistry.getService('auth')).toThrow('not configured');
  });

  it('should throw for unknown service', () => {
    ServiceRegistry.configure({ services: {} });
    expect(() => ServiceRegistry.getService('ghost')).toThrow('not found');
  });

  it('should return a cached client on second call', () => {
    ServiceRegistry.configure(makeConfig(mockAdapter()));
    const first = ServiceRegistry.getService('auth');
    const second = ServiceRegistry.getService('auth');
    expect(first).toBe(second);
  });

  it('should create RpcClient instances', () => {
    ServiceRegistry.configure(makeConfig(mockAdapter()));
    expect(ServiceRegistry.getService('auth')).toBeInstanceOf(RpcClient);
    expect(ServiceRegistry.getService('mailer')).toBeInstanceOf(RpcClient);
  });

  it('clear() should reset everything', () => {
    ServiceRegistry.configure(makeConfig(mockAdapter()));
    ServiceRegistry.getService('auth');
    ServiceRegistry.clear();
    expect(() => ServiceRegistry.getService('auth')).toThrow('not configured');
  });
});
