export interface IWebSocketServerConfig {
  cors?: {
    origin: string | string[];
    methods?: string[];
    credentials?: boolean;
  };
  pingInterval?: number;
  pingTimeout?: number;
  connectionStateRecovery?: {
    maxDisconnectionDuration?: number;
    skipMiddlewares?: boolean;
  };
  path?: string;
  cleanupEmptyChildNamespaces?: boolean;
}
