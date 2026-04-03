import type { Response as ExpressResponse, ErrorRequestHandler } from 'express';
import type { IErrorStrategy } from './IErrorStrategy';
import { AppError } from './AppError';
import { ValidationError } from './ValidationError';
import { Logger } from '../logger';

const logger = new Logger('ErrorHandler');

class ValidationErrorStrategy implements IErrorStrategy {
  canHandle(err: Error): boolean {
    return err instanceof ValidationError;
  }

  handle(err: Error, res: ExpressResponse): void {
    const validationErr = err as ValidationError;
    res.status(validationErr.statusCode).json({
      status: 'error',
      code: validationErr.code,
      message: validationErr.message,
      details: validationErr.details,
    });
  }
}

class AppErrorStrategy implements IErrorStrategy {
  canHandle(err: Error): boolean {
    return err instanceof AppError;
  }

  handle(err: Error, res: ExpressResponse): void {
    const appErr = err as AppError;
    logger.warn(appErr.message, { code: appErr.code, statusCode: appErr.statusCode });
    res.status(appErr.statusCode).json({
      status: 'error',
      code: appErr.code,
      message: appErr.message,
    });
  }
}

class FallbackErrorStrategy implements IErrorStrategy {
  canHandle(): boolean {
    return true;
  }

  handle(err: Error, res: ExpressResponse): void {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}

const DEFAULT_STRATEGIES: IErrorStrategy[] = [
  new ValidationErrorStrategy(),
  new AppErrorStrategy(),
  new FallbackErrorStrategy(),
];

export function createErrorHandler(strategies: IErrorStrategy[] = DEFAULT_STRATEGIES): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const strategy = strategies.find((s) => s.canHandle(err));
    strategy!.handle(err, res);
  };
}
