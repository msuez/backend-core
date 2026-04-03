import { describe, it, expect, beforeAll } from '@jest/globals';
import { S3StorageService } from '../../src/storage/S3StorageService';
import type { IS3StorageConfig } from '../../src/storage/IS3StorageConfig';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

// Integration tests require a real S3 bucket or localstack.
// Unit tests here verify instantiation and interface contract.

describe('S3StorageService', () => {
  const config: IS3StorageConfig = {
    bucket: 'test-bucket',
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  };

  it('can be instantiated with valid config', () => {
    const service = new S3StorageService(config);
    expect(service).toBeDefined();
  });

  it('implements IStorageService interface', () => {
    const service = new S3StorageService(config);
    expect(typeof service.upload).toBe('function');
    expect(typeof service.download).toBe('function');
    expect(typeof service.delete).toBe('function');
    expect(typeof service.getSignedUrl).toBe('function');
  });

  it('accepts an injected S3Client for testability', async () => {
    // Fake S3Client — implements only the minimal surface needed by S3StorageService
    const uploadedKeys: string[] = [];

    const fakeS3 = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        const commandName = command.constructor.name;

        if (commandName === 'PutObjectCommand') {
          uploadedKeys.push(command.input['Key'] as string);
          return {};
        }

        if (commandName === 'GetObjectCommand') {
          const content = Buffer.from('file-content');
          // Simulate a readable stream via async iterator
          return {
            Body: (async function* () {
              yield content;
            })(),
          };
        }

        if (commandName === 'DeleteObjectCommand') {
          return {};
        }

        throw new Error(`Unexpected command: ${commandName}`);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new S3StorageService(config, fakeS3 as any);

    const result = await service.upload(Buffer.from('hello'), 'uploads/test.txt', {
      contentType: 'text/plain',
    });
    expect(result.key).toBe('uploads/test.txt');
    expect(result.size).toBe(5);
    expect(result.contentType).toBe('text/plain');
    expect(uploadedKeys).toContain('uploads/test.txt');

    const downloaded = await service.download('uploads/test.txt');
    expect(downloaded.toString()).toBe('file-content');

    await expect(service.delete('uploads/test.txt')).resolves.toBeUndefined();
  });
});
