export interface IClosable {
  name: string;
  close(): Promise<void>;
}
