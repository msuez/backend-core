export interface IUploadConfig {
  folder: string;
  maxSize?: string | number;
  allowed?: string[];
  multiple?: boolean;
  fieldName?: string;
}
