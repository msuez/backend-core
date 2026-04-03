import { LocalStorageService } from './LocalStorageService';
import { S3StorageService } from './S3StorageService';
import type { IStorageService } from './IStorageService';
import type { ILocalStorageConfig } from './ILocalStorageConfig';
import type { IS3StorageConfig } from './IS3StorageConfig';

export type StorageDriver = 'local' | 's3';

export type StorageServiceConfig =
  | ({ driver: 'local' } & ILocalStorageConfig)
  | ({ driver: 's3' } & IS3StorageConfig);

export function createStorageService(config?: StorageServiceConfig): IStorageService {
  const driver = (config?.driver ?? process.env['STORAGE_DRIVER'] ?? 'local') as StorageDriver;

  if (driver === 's3') {
    const s3 = config as ({ driver: 's3' } & IS3StorageConfig) | undefined;
    const bucket = s3?.bucket ?? process.env['S3_BUCKET'];
    if (!bucket) throw new Error('S3 bucket name is required. Set S3_BUCKET env var or pass bucket in config.');
    return new S3StorageService({
      bucket,
      region: s3?.region ?? process.env['S3_REGION'] ?? 'us-east-1',
      accessKeyId: s3?.accessKeyId ?? process.env['S3_ACCESS_KEY_ID'],
      secretAccessKey: s3?.secretAccessKey ?? process.env['S3_SECRET_ACCESS_KEY'],
      endpoint: s3?.endpoint ?? process.env['S3_ENDPOINT'],
    });
  }

  const local = config as ({ driver: 'local' } & ILocalStorageConfig) | undefined;
  return new LocalStorageService({
    basePath: local?.basePath ?? process.env['STORAGE_LOCAL_PATH'],
  });
}
