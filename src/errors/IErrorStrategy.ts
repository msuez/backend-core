import type { Response as ExpressResponse } from 'express';

export interface IErrorStrategy {
  canHandle(err: Error): boolean;
  handle(err: Error, res: ExpressResponse): void;
}
