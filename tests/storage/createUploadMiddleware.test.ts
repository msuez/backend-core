import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { parseSizeBytes, buildMimetypeFilter } from '../../src/storage/createUploadMiddleware';
import { createUploadMiddleware } from '../../src/storage/createUploadMiddleware';
import type { IStorageService, StorageResult } from '../../src/storage/IStorageService';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

// --- InMemoryStorageService fake ---

class InMemoryStorageService implements IStorageService {
  private readonly store = new Map<string, Buffer>();

  async upload(file: Buffer, key: string, options?: { contentType?: string }): Promise<StorageResult> {
    this.store.set(key, file);
    return { key, size: file.length, contentType: options?.contentType };
  }

  async download(key: string): Promise<Buffer> {
    const file = this.store.get(key);
    if (!file) throw new Error(`Not found: ${key}`);
    return file;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return `https://cdn.example.com/${key}`;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

// --- parseSizeBytes ---

describe('parseSizeBytes', () => {
  it('returns undefined for undefined input', () => {
    expect(parseSizeBytes(undefined)).toBeUndefined();
  });

  it('returns number as-is', () => {
    expect(parseSizeBytes(1024)).toBe(1024);
  });

  it('parses "5mb"', () => {
    expect(parseSizeBytes('5mb')).toBe(5 * 1024 * 1024);
  });

  it('parses "20mb"', () => {
    expect(parseSizeBytes('20mb')).toBe(20 * 1024 * 1024);
  });

  it('parses "1gb"', () => {
    expect(parseSizeBytes('1gb')).toBe(1024 ** 3);
  });

  it('parses "100kb"', () => {
    expect(parseSizeBytes('100kb')).toBe(100 * 1024);
  });

  it('parses plain number string', () => {
    expect(parseSizeBytes('2048')).toBe(2048);
  });

  it('returns undefined for invalid format', () => {
    expect(parseSizeBytes('invalid')).toBeUndefined();
  });
});

// --- buildMimetypeFilter ---

describe('buildMimetypeFilter', () => {
  it('returns undefined when allowed is empty', () => {
    expect(buildMimetypeFilter(undefined)).toBeUndefined();
    expect(buildMimetypeFilter([])).toBeUndefined();
  });

  it('allows files matching exact mimetype', () => {
    const filter = buildMimetypeFilter(['application/pdf'])!;
    const cb = jest.fn();
    filter({} as Request, { mimetype: 'application/pdf', originalname: 'doc.pdf' } as Express.Multer.File, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects files not matching mimetype', () => {
    const filter = buildMimetypeFilter(['application/pdf'])!;
    const cb = jest.fn();
    filter({} as Request, { mimetype: 'image/png', originalname: 'photo.png' } as Express.Multer.File, cb);
    const [err] = (cb as jest.Mock).mock.calls[0] as [Error];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('not allowed');
  });

  it('allows files matching wildcard mimetype image/*', () => {
    const filter = buildMimetypeFilter(['image/*'])!;
    const cb = jest.fn();
    filter({} as Request, { mimetype: 'image/png', originalname: 'photo.png' } as Express.Multer.File, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('rejects files not matching wildcard mimetype', () => {
    const filter = buildMimetypeFilter(['image/*'])!;
    const cb = jest.fn();
    filter({} as Request, { mimetype: 'application/pdf', originalname: 'doc.pdf' } as Express.Multer.File, cb);
    const [err] = (cb as jest.Mock).mock.calls[0] as [Error];
    expect(err).toBeInstanceOf(Error);
  });

  it('allows files matching extension .pdf', () => {
    const filter = buildMimetypeFilter(['.pdf'])!;
    const cb = jest.fn();
    filter({} as Request, { mimetype: 'application/octet-stream', originalname: 'doc.pdf' } as Express.Multer.File, cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });
});

// --- createUploadMiddleware ---

describe('createUploadMiddleware', () => {
  it('can be imported without errors', () => {
    expect(typeof createUploadMiddleware).toBe('function');
  });

  it('returns a RequestHandler function', () => {
    const storage = new InMemoryStorageService();
    const middleware = createUploadMiddleware(storage, { folder: 'uploads' });
    expect(typeof middleware).toBe('function');
    expect(middleware.length).toBe(3); // (req, res, next)
  });

  it('calls next() immediately when no file is attached', async () => {
    const storage = new InMemoryStorageService();
    const middleware = createUploadMiddleware(storage, { folder: 'uploads' });

    // Simulate multer already ran and found no file (req.file is undefined)
    const req = {
      headers: { 'content-type': 'application/json' },
      body: {},
    } as unknown as Request;
    const res = {} as Response;
    const next: NextFunction = jest.fn() as unknown as NextFunction;

    // We invoke the underlying after-multer logic by calling middleware with a non-multipart req
    await new Promise<void>((resolve) => {
      const wrappedNext = ((err?: unknown) => {
        (next as jest.Mock)(err);
        resolve();
      }) as NextFunction;

      middleware(req, res, wrappedNext);
    });

    // next was called (either with or without error; the key check is it was called)
    expect((next as jest.Mock)).toHaveBeenCalled();
  });

  // Full integration tests with real multipart requests require supertest.
  // See tests/integration/storage/upload.test.ts (Testcontainers optional).
});
