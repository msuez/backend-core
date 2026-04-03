import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LocalStorageService } from '../../src/storage/LocalStorageService';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

describe('LocalStorageService', () => {
  let tmpDir: string;
  let service: LocalStorageService;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    service = new LocalStorageService({ basePath: tmpDir });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('upload', () => {
    it('writes file to disk and returns StorageResult', async () => {
      const file = Buffer.from('hello world');
      const result = await service.upload(file, 'docs/hello.txt', { contentType: 'text/plain' });

      expect(result.key).toBe('docs/hello.txt');
      expect(result.size).toBe(11);
      expect(result.contentType).toBe('text/plain');

      const written = await fs.promises.readFile(path.join(tmpDir, 'docs/hello.txt'));
      expect(written.toString()).toBe('hello world');
    });

    it('creates nested directories automatically', async () => {
      const file = Buffer.from('data');
      await service.upload(file, 'a/b/c/file.bin');

      const exists = await fs.promises
        .access(path.join(tmpDir, 'a/b/c/file.bin'))
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it('returns size=0 for empty buffer', async () => {
      const result = await service.upload(Buffer.alloc(0), 'empty.bin');
      expect(result.size).toBe(0);
    });
  });

  describe('download', () => {
    it('returns the uploaded file content', async () => {
      const original = Buffer.from('test content');
      await service.upload(original, 'test.txt');

      const downloaded = await service.download('test.txt');
      expect(downloaded.toString()).toBe('test content');
    });

    it('throws when file does not exist', async () => {
      await expect(service.download('nonexistent.txt')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('removes the file from disk', async () => {
      await service.upload(Buffer.from('bye'), 'bye.txt');
      await service.delete('bye.txt');

      const exists = await fs.promises
        .access(path.join(tmpDir, 'bye.txt'))
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);
    });

    it('throws when file does not exist', async () => {
      await expect(service.delete('ghost.txt')).rejects.toThrow();
    });
  });

  describe('getSignedUrl', () => {
    it('returns a file:// URL pointing to the correct path', async () => {
      await service.upload(Buffer.from('x'), 'images/photo.jpg');
      const url = await service.getSignedUrl('images/photo.jpg');

      expect(url).toMatch(/^file:\/\//);
      expect(url).toContain('images/photo.jpg');
    });

    it('ignores expiresIn parameter (local storage has no expiry)', async () => {
      await service.upload(Buffer.from('x'), 'file.txt');
      const url1 = await service.getSignedUrl('file.txt', 60);
      const url2 = await service.getSignedUrl('file.txt', 3600);

      expect(url1).toBe(url2);
    });
  });
});
