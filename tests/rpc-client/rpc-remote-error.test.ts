import { describe, it, expect } from '@jest/globals';
import { RpcRemoteError } from '../../src/rpc-client/RpcRemoteError';
import type { RpcErrorObject } from '../../src/rpc/types';

describe('RpcRemoteError', () => {
  const errorObj: RpcErrorObject = {
    message: 'Not found',
    name: 'NotFoundError',
    showable: true,
    internal: false,
    item: 'user-42',
  };

  it('should be an instance of Error', () => {
    const err = new RpcRemoteError(errorObj);
    expect(err).toBeInstanceOf(Error);
  });

  it('should prefix name with "Remote"', () => {
    const err = new RpcRemoteError(errorObj);
    expect(err.name).toBe('RemoteNotFoundError');
  });

  it('should preserve the original error message', () => {
    const err = new RpcRemoteError(errorObj);
    expect(err.message).toBe('Not found');
  });

  it('should expose the full error object', () => {
    const err = new RpcRemoteError(errorObj);
    expect(err.errorObject).toBe(errorObj);
    expect(err.errorObject.item).toBe('user-42');
  });

  it('should expose showable and internal flags', () => {
    const err = new RpcRemoteError(errorObj);
    expect(err.showable).toBe(true);
    expect(err.internal).toBe(false);
  });
});
