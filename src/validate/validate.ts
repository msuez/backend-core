import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../errors';

export function validate(schema: ZodSchema, source: 'body' | 'params' | 'query') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.issues));
      return;
    }

    req[source] = result.data;
    next();
  };
}
