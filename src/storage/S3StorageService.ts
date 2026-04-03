import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '../logger';
import type { IStorageService, UploadOptions, StorageResult } from './IStorageService';
import type { IS3StorageConfig } from './IS3StorageConfig';

const logger = new Logger('S3Storage');

export class S3StorageService implements IStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: IS3StorageConfig,
    client?: S3Client,
  ) {
    this.bucket = config.bucket;
    this.client =
      client ??
      new S3Client({
        region: config.region,
        ...(config.accessKeyId && config.secretAccessKey
          ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
          : {}),
        ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      });
  }

  async upload(file: Buffer, key: string, options?: UploadOptions): Promise<StorageResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      }),
    );

    logger.debug(`Uploaded ${key}`, { bucket: this.bucket, size: file.length });

    return { key, size: file.length, contentType: options?.contentType };
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new Error(`Empty body for key: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    logger.debug(`Downloaded ${key}`);
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    logger.debug(`Deleted ${key}`);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
