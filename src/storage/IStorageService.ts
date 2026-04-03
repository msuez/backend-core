export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageResult {
  key: string;
  size: number;
  contentType?: string;
}

export interface IStorageService {
  upload(file: Buffer, key: string, options?: UploadOptions): Promise<StorageResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
