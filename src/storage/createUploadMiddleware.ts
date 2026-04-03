import multer from 'multer';
import path from 'node:path';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Logger } from '../logger';
import type { IStorageService, StorageResult } from './IStorageService';
import type { IUploadConfig } from './IUploadConfig';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uploadedFile?: StorageResult;
      uploadedFiles?: StorageResult[];
    }
  }
}

const logger = new Logger('UploadMiddleware');

export function parseSizeBytes(size: string | number | undefined): number | undefined {
  if (size === undefined) return undefined;
  if (typeof size === 'number') return size;

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(kb|mb|gb)?$/);
  if (!match) return undefined;

  const value = parseFloat(match[1] ?? '0');
  const unit = match[2];
  const multipliers: Record<string, number> = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return unit ? Math.floor(value * (multipliers[unit] ?? 1)) : Math.floor(value);
}

export function buildMimetypeFilter(
  allowed: string[] | undefined,
): multer.Options['fileFilter'] {
  if (!allowed || allowed.length === 0) return undefined;

  return (_req, file, cb) => {
    const mimetype = file.mimetype;
    const ext = path.extname(file.originalname).toLowerCase();

    const isAllowed = allowed.some((pattern) => {
      if (pattern.startsWith('.')) return ext === pattern.toLowerCase();
      if (pattern.endsWith('/*')) return mimetype.startsWith(pattern.slice(0, -1));
      return mimetype === pattern;
    });

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: ${allowed.join(', ')}`));
    }
  };
}

export function createUploadMiddleware(
  storage: IStorageService,
  config: IUploadConfig,
): RequestHandler {
  const fieldName = config.fieldName ?? 'file';
  const maxFileSize = parseSizeBytes(config.maxSize);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: maxFileSize ? { fileSize: maxFileSize } : undefined,
    fileFilter: buildMimetypeFilter(config.allowed),
  });

  const multerHandler = config.multiple
    ? upload.array(fieldName)
    : upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    multerHandler(req, res, async (err) => {
      if (err) {
        next(err);
        return;
      }

      const files: Express.Multer.File[] = config.multiple
        ? ((req.files as Express.Multer.File[] | undefined) ?? [])
        : req.file
          ? [req.file]
          : [];

      if (files.length === 0) {
        next();
        return;
      }

      try {
        const results = await Promise.all(
          files.map((file) => {
            const key = `${config.folder}/${Date.now()}-${file.originalname}`;
            return storage.upload(file.buffer, key, { contentType: file.mimetype });
          }),
        );

        if (config.multiple) {
          req.uploadedFiles = results;
        } else {
          req.uploadedFile = results[0];
        }

        logger.debug('Files uploaded', { count: results.length, folder: config.folder });
        next();
      } catch (uploadErr) {
        next(uploadErr);
      }
    });
  };
}
