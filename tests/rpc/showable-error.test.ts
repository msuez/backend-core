import { describe, it, expect } from '@jest/globals';
import { ShowableError, wrapError } from '../../src/rpc/ShowableError';

describe('ShowableError', () => {
  it('should serialize to JSON with showable=true, internal=false', () => {
    const err = new ShowableError('Something went wrong');
    const json = err.toJSON();

    expect(json).toEqual({
      message: 'Something went wrong',
      name: 'ShowableError',
      showable: true,
      internal: false,
    });
  });

  it('should allow subclasses to extend the JSON', () => {
    class NotFoundError extends ShowableError {
      private item: string;
      constructor(item: string) {
        super(`${item} not found`);
        this.item = item;
      }
      extendShowableError() {
        return { item: this.item };
      }
    }

    const err = new NotFoundError('user-42');
    const json = err.toJSON();

    expect(json.message).toBe('user-42 not found');
    expect(json.name).toBe('NotFoundError');
    expect(json.showable).toBe(true);
    expect(json.item).toBe('user-42');
  });

  it('should use constructor name as error name', () => {
    class CustomError extends ShowableError {}
    const err = new CustomError('test');
    expect(err.name).toBe('CustomError');
    expect(err.toJSON().name).toBe('CustomError');
  });
});

describe('wrapError', () => {
  it('should serialize ShowableError via toJSON()', () => {
    const err = new ShowableError('visible error');
    const wrapped = wrapError(err);

    expect(wrapped.showable).toBe(true);
    expect(wrapped.internal).toBe(false);
    expect(wrapped.message).toBe('visible error');
  });

  it('should wrap unknown Error as internal', () => {
    const err = new Error('something unexpected');
    const wrapped = wrapError(err);

    expect(wrapped.showable).toBe(false);
    expect(wrapped.internal).toBe(true);
    expect(wrapped.name).toBe('UnknownError');
    expect(wrapped.message).toBe('something unexpected');
  });

  it('should handle non-Error values', () => {
    const wrapped = wrapError('string error');

    expect(wrapped.showable).toBe(false);
    expect(wrapped.internal).toBe(true);
    expect(wrapped.name).toBe('UnknownError');
    expect(wrapped.message).toBe('string error');
  });

  it('should handle null/undefined', () => {
    const wrapped = wrapError(null);
    expect(wrapped.name).toBe('UnknownError');
    expect(wrapped.message).toBe('null');
  });
});
