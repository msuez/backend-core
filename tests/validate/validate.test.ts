import { jest, describe, it, expect } from '@jest/globals';
import { validate } from '../../src/validate/validate';
import { ValidationError } from '../../src/errors/ValidationError';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  email: z.string().email(),
});

function createFakeReq(body: unknown): Partial<Request> {
  return { body };
}

describe('validate middleware', () => {
  const middleware = validate(schema, 'body');
  const fakeRes = {} as Response;

  it('valid body → calls next() without error', () => {
    const req = createFakeReq({ name: 'Alice', email: 'alice@example.com' }) as Request;
    const next = jest.fn();

    middleware(req, fakeRes, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('invalid body → calls next() with ValidationError', () => {
    const req = createFakeReq({ name: 123 }) as Request;
    const next: NextFunction = jest.fn();

    middleware(req, fakeRes, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as ValidationError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.length).toBeGreaterThan(0);
  });

  it('valid body updates req.body with parsed data', () => {
    const req = createFakeReq({ name: 'Bob', email: 'bob@test.com', extra: 'ignored' }) as Request;
    const next = jest.fn();

    middleware(req, fakeRes, next);

    // Zod strips extra keys by default
    expect(req.body).toEqual({ name: 'Bob', email: 'bob@test.com' });
  });
});
