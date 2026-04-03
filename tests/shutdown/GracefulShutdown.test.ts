import { describe, it, expect, beforeAll } from '@jest/globals';
import { GracefulShutdown } from '../../src/shutdown/GracefulShutdown';
import type { IClosable } from '../../src/shutdown/IClosable';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

class FakeClosable implements IClosable {
  public closed = false;

  constructor(public readonly name: string) {}

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe('GracefulShutdown', () => {
  it('constructor accepts closables array', () => {
    const closables = [new FakeClosable('db'), new FakeClosable('redis')];

    expect(() => new GracefulShutdown(closables)).not.toThrow();
  });

  it('constructor accepts custom timeout', () => {
    const closables = [new FakeClosable('db')];

    expect(() => new GracefulShutdown(closables, 5000)).not.toThrow();
  });

  it('register() does not throw', () => {
    const closables = [new FakeClosable('db')];
    const shutdown = new GracefulShutdown(closables);

    // NOTE: We do NOT test actual SIGTERM — it would kill the test process.
    // register() just attaches signal handlers.
    expect(() => shutdown.register()).not.toThrow();
  });
});
