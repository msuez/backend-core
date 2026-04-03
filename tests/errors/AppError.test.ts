import { describe, it, expect } from '@jest/globals';
import { AppError } from '../../src/errors/AppError';
import { NotFoundError } from '../../src/errors/NotFoundError';
import { ValidationError } from '../../src/errors/ValidationError';
import type { ZodIssue } from 'zod';

describe('AppError', () => {
  it('has correct defaults (500, INTERNAL_ERROR)', () => {
    const err = new AppError('something went wrong');

    expect(err.message).toBe('something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('AppError');
  });

  it('extends Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('accepts custom statusCode and code', () => {
    const err = new AppError('custom', 422, 'CUSTOM_CODE');

    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('CUSTOM_CODE');
  });
});

describe('NotFoundError', () => {
  it('has 404 and NOT_FOUND code', () => {
    const err = new NotFoundError('User');

    expect(err.message).toBe('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
  });

  it('extends Error and AppError', () => {
    const err = new NotFoundError('User');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('has 400, VALIDATION_ERROR, and details array', () => {
    const details: ZodIssue[] = [
      { code: 'invalid_type', message: 'Required', path: ['name'], expected: 'string', received: 'undefined' },
    ];
    const err = new ValidationError('Validation failed', details);

    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
    expect(err.name).toBe('ValidationError');
  });

  it('extends Error and AppError', () => {
    const err = new ValidationError('fail', []);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});
