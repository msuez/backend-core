import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { TypedEventBus } from '../../src/events/TypedEventBus';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

interface ITestEventMap {
  'user.created': { id: string; name: string };
  'user.deleted': { id: string };
}

describe('TypedEventBus', () => {
  let bus: TypedEventBus<ITestEventMap>;

  beforeEach(() => {
    bus = new TypedEventBus<ITestEventMap>();
  });

  it('handler receives correct payload on emit', (done) => {
    bus.on('user.created', (payload) => {
      expect(payload).toEqual({ id: '1', name: 'Alice' });
      done();
    });

    bus.emit('user.created', { id: '1', name: 'Alice' });
  });

  it('multiple listeners on same event all receive payload', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    bus.on('user.created', handler1);
    bus.on('user.created', handler2);

    bus.emit('user.created', { id: '2', name: 'Bob' });

    expect(handler1).toHaveBeenCalledWith({ id: '2', name: 'Bob' });
    expect(handler2).toHaveBeenCalledWith({ id: '2', name: 'Bob' });
  });

  it('different events do not cross-fire', () => {
    const createdHandler = jest.fn();
    const deletedHandler = jest.fn();

    bus.on('user.created', createdHandler);
    bus.on('user.deleted', deletedHandler);

    bus.emit('user.created', { id: '3', name: 'Carol' });

    expect(createdHandler).toHaveBeenCalledTimes(1);
    expect(deletedHandler).not.toHaveBeenCalled();
  });
});
