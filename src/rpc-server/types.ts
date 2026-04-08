import type { RpcRequest, HttpRpcResponse } from '../rpc';

// ============================================================
// Consumer (receiving side)
// ============================================================

export interface CommandResult<T = unknown> {
  body: RpcRequest;
  data: HttpRpcResponse<T>;
}

export type RpcMessageHandler = (
  message: RpcRequest,
) => Promise<CommandResult>;

export interface IConsumer {
  start(handler: RpcMessageHandler): Promise<void>;
  stop(): Promise<void>;
}

// ============================================================
// Server: Middleware & Commands
// ============================================================

export type MiddlewarePhase =
  | 'all'
  | 'pre'
  | 'context'
  | 'params'
  | 'resolved'
  | 'rejected';

export interface MiddlewareEntry {
  name: string;
  phase: MiddlewarePhase;
  callback: (...args: unknown[]) => unknown;
}

export interface CommandDefinition {
  namespace: string;
  cmd: string;
  func: (...args: unknown[]) => unknown;
  contextuable: string[] | false;
}
