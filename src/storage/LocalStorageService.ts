import fs from 'node:fs';
import path from 'node:path';
import { Logger } from '../logger';
import type { IStorageService, UploadOptions, StorageResult } from './IStorageService';
import type { ILocalStorageConfig } from './ILocalStorageConfig';

export class LocalStorageService implements IStorageService {
  private readonly basePath: string;
  private readonly logger = new Logger('LocalStorage');

  constructor(config: ILocalStorageConfig = {}) {
    this.basePath = config.basePath ?? '.storage';
  }

  async upload(file: Buffer, key: string, options?: UploadOptions): Promise<StorageResult> {
    const filePath = path.join(this.basePath, key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, file);

    this.logger.debug(`Uploaded ${key}`, { size: file.length, contentType: options?.contentType });

    return { key, size: file.length, contentType: options?.contentType };
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    this.logger.debug(`Downloading ${key}`);
    return fs.promises.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    await fs.promises.unlink(filePath);
    this.logger.debug(`Deleted ${key}`);
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    const filePath = path.resolve(path.join(this.basePath, key));
    return `file://${filePath}`;
  }
}
