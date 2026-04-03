import type { ZodIssue } from 'zod';
import { AppError } from './AppError';

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly details: ZodIssue[],
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
