import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { createStorageService } from '../../src/storage/createStorageService';
import { LocalStorageService } from '../../src/storage/LocalStorageService';
import { S3StorageService } from '../../src/storage/S3StorageService';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

describe('createStorageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns LocalStorageService when STORAGE_DRIVER=local', () => {
    process.env['STORAGE_DRIVER'] = 'local';
    const service = createStorageService();
    expect(service).toBeInstanceOf(LocalStorageService);
  });

  it('returns LocalStorageService by default (no env var set)', () => {
    delete process.env['STORAGE_DRIVER'];
    const service = createStorageService();
    expect(service).toBeInstanceOf(LocalStorageService);
  });

  it('returns S3StorageService when STORAGE_DRIVER=s3', () => {
    process.env['STORAGE_DRIVER'] = 's3';
    process.env['S3_BUCKET'] = 'my-bucket';
    process.env['S3_REGION'] = 'us-east-1';
    const service = createStorageService();
    expect(service).toBeInstanceOf(S3StorageService);
  });

  it('returns LocalStorageService with explicit driver config', () => {
    const service = createStorageService({ driver: 'local', basePath: '/tmp/test' });
    expect(service).toBeInstanceOf(LocalStorageService);
  });

  it('returns S3StorageService with explicit driver config', () => {
    const service = createStorageService({
      driver: 's3',
      bucket: 'my-bucket',
      region: 'eu-west-1',
    });
    expect(service).toBeInstanceOf(S3StorageService);
  });

  it('throws when STORAGE_DRIVER=s3 and S3_BUCKET is not set', () => {
    process.env['STORAGE_DRIVER'] = 's3';
    delete process.env['S3_BUCKET'];
    expect(() => createStorageService()).toThrow('S3 bucket name is required');
  });

  it('throws when driver=s3 is passed explicitly without a bucket', () => {
    expect(() =>
      createStorageService({ driver: 's3', bucket: '', region: 'us-east-1' }),
    ).toThrow('S3 bucket name is required');
  });
});
