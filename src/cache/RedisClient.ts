import Redis from 'ioredis';
import type { ICacheClient } from './ICacheClient';

export class RedisClient extends Redis implements ICacheClient {
  constructor(url: string) {
    super(url);
  }
}
