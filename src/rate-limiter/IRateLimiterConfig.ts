import type { Request } from 'express';

export interface IRateLimiterConfig {
  keyPrefix: string;
  points: number;
  duration: number;
  keyExtractor: (req: Request) => string | null;
}
