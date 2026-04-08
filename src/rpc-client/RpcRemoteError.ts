import type { RpcErrorObject } from '../rpc';

/**
 * Wraps an error received from a remote RPC service.
 * Preserves the original error object for inspection.
 */
export class RpcRemoteError extends Error {
  private readonly _errObject: RpcErrorObject;

  constructor(errObject: RpcErrorObject) {
    super(errObject.message);
    this._errObject = errObject;
    this.name = `Remote${errObject.name}`;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  get errorObject(): RpcErrorObject {
    return this._errObject;
  }

  get showable(): boolean {
    return this._errObject.showable;
  }

  get internal(): boolean {
    return this._errObject.internal;
  }
}
