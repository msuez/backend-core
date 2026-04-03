import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { createErrorHandler } from '../../src/errors/ValidationErrorStrategy';
import { ValidationError } from '../../src/errors/ValidationError';
import { AppError } from '../../src/errors/AppError';
import { Logger } from '../../src/logger/Logger';
import type { Request, Response, NextFunction } from 'express';

beforeAll(() => Logger.init({ level: 'silent' }));

function createFakeRes() {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const res = { status: statusMock } as unknown as Response;
  return { res, statusMock, jsonMock };
}

describe('createErrorHandler', () => {
  const handler = createErrorHandler();
  const fakeReq = {} as Request;
  const fakeNext: NextFunction = jest.fn();

  it('creates a function', () => {
    expect(typeof handler).toBe('function');
  });

  it('handles ValidationError with 400 and details', () => {
    const details: import('zod').ZodIssue[] = [
      { code: 'invalid_type', message: 'Required', path: ['email'], expected: 'string', received: 'undefined' },
    ];
    const err = new ValidationError('Validation failed', details);
    const { res, statusMock, jsonMock } = createFakeRes();

    handler(err, fakeReq, res, fakeNext);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      }),
    );
  });

  it('handles AppError with correct statusCode', () => {
    const err = new AppError('Forbidden', 403, 'FORBIDDEN');
    const { res, statusMock, jsonMock } = createFakeRes();

    handler(err, fakeReq, res, fakeNext);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'Forbidden',
      }),
    );
  });

  it('handles unknown Error with 500', () => {
    const err = new Error('unexpected');
    const { res, statusMock, jsonMock } = createFakeRes();

    handler(err, fakeReq, res, fakeNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }),
    );
  });
});
