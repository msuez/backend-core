import type { RpcErrorObject } from './types';

/**
 * Base class for user-facing errors that can be safely serialized
 * and sent across the RPC boundary.
 *
 * Subclasses override `extendShowableError()` to add domain-specific fields.
 */
export class ShowableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  extendShowableError(): Record<string, unknown> {
    return {};
  }

  getMessage(): string {
    return this.message;
  }

  toJSON(): RpcErrorObject {
    return {
      message: this.getMessage(),
      name: this.name,
      showable: true,
      internal: false,
      ...this.extendShowableError(),
    };
  }
}

/**
 * Serializes an error into a standard RPC error object.
 */
export function wrapError(error: unknown): RpcErrorObject {
  if (error instanceof ShowableError) {
    return error.toJSON();
  }

  const message =
    error instanceof Error ? error.message : String(error);

  return {
    message,
    showable: false,
    internal: true,
    name: 'UnknownError',
  };
}
