import { jest, describe, it, expect } from '@jest/globals';
import { RpcClient } from '../../src/rpc-client/RpcClient';
import { RpcRemoteError } from '../../src/rpc-client/RpcRemoteError';
import type { IProducer } from '../../src/rpc-client/types';
import type { HttpRpcResponse } from '../../src/rpc/types';

function mockHttpProducer(response: HttpRpcResponse): IProducer {
  return {
    send: jest.fn<IProducer['send']>().mockResolvedValue(response),
  };
}

function mockQueueProducer(): IProducer {
  return {
    send: jest.fn<IProducer['send']>().mockResolvedValue(undefined),
  };
}

describe('RpcClient (http mode)', () => {
  it('should send an HTTP RPC request with uid', async () => {
    const producer = mockHttpProducer({
      uid: 'any', succes: true, error: null, result: { data: 'hello' },
    });

    const client = new RpcClient('auth', producer, 'http');
    const result = await client.execute('auth:greet', 'world');

    expect(result).toEqual({ data: 'hello' });
    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: expect.any(String), cmd: 'auth:greet', params: ['world'], context: {},
      }),
    );
  });

  it('should throw RpcRemoteError when response has error', async () => {
    const producer = mockHttpProducer({
      uid: '1', succes: false,
      error: { message: 'Not found', name: 'NotFoundError', showable: true, internal: false },
      result: undefined as unknown,
    });

    const client = new RpcClient('auth', producer, 'http');
    await expect(client.execute('auth:find', 'missing')).rejects.toThrow(RpcRemoteError);
  });

  it('should resolve context from async function before sending', async () => {
    const producer = mockHttpProducer({
      uid: '1', succes: true, error: null, result: 'ok',
    });

    const client = new RpcClient('auth', producer, 'http', async () => ({ userId: 'u42' }));
    await client.execute('auth:check');

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ context: { userId: 'u42' } }),
    );
  });

  it('should resolve context from sync function', async () => {
    const producer = mockHttpProducer({
      uid: '1', succes: true, error: null, result: 'ok',
    });

    const client = new RpcClient('auth', producer, 'http', () => ({ role: 'admin' }));
    await client.execute('auth:check');

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ context: { role: 'admin' } }),
    );
  });

  it('should resolve context from plain object', async () => {
    const producer = mockHttpProducer({
      uid: '1', succes: true, error: null, result: 'ok',
    });

    const client = new RpcClient('auth', producer, 'http', { key: 'value' });
    await client.execute('auth:check');

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ context: { key: 'value' } }),
    );
  });

  it('should resolve context from promise', async () => {
    const producer = mockHttpProducer({
      uid: '1', succes: true, error: null, result: 'ok',
    });

    const client = new RpcClient('auth', producer, 'http', Promise.resolve({ token: 'abc' }));
    await client.execute('auth:check');

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ context: { token: 'abc' } }),
    );
  });

  it('should default context to empty object', async () => {
    const producer = mockHttpProducer({
      uid: '1', succes: true, error: null, result: 'ok',
    });

    const client = new RpcClient('auth', producer, 'http');
    await client.execute('auth:check');

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ context: {} }),
    );
  });
});

describe('RpcClient (queue mode)', () => {
  it('should send a queue RPC request without uid', async () => {
    const producer = mockQueueProducer();
    const client = new RpcClient('mailer', producer, 'queue');
    await client.execute('mailer:send', 'user-1', 'welcome');

    expect(producer.send).toHaveBeenCalledWith({
      cmd: 'mailer:send', params: ['user-1', 'welcome'], context: {},
    });
  });

  it('should return void (fire-and-forget)', async () => {
    const producer = mockQueueProducer();
    const client = new RpcClient('mailer', producer, 'queue');
    const result = await client.execute('mailer:send', 'user-1');
    expect(result).toBeUndefined();
  });

  it('should resolve context before sending', async () => {
    const producer = mockQueueProducer();
    const client = new RpcClient('mailer', producer, 'queue', () => ({ source: 'api' }));
    await client.execute('mailer:send');

    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ context: { source: 'api' } }),
    );
  });
});
