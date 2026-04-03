// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IWebSocketEvents {
  serverToClient: Record<string, (...args: any[]) => void>;
  clientToServer: Record<string, (...args: any[]) => void>;
  interServer: Record<string, (...args: any[]) => void>;
  socketData: Record<string, unknown>;
}
