// ============================================================
// Context
// ============================================================

export type ContextValue = Record<string, unknown>;

export type ContextProvider =
  | ContextValue
  | Promise<ContextValue>
  | (() => ContextValue)
  | (() => Promise<ContextValue>);

// ============================================================
// Wire Format — Messages
// ============================================================

export interface RpcRequest {
  cmd: string;
  params: unknown[];
  context: ContextValue;
}

export interface HttpRpcRequest extends RpcRequest {
  uid: string;
}

export interface RpcErrorObject {
  message: string;
  name: string;
  showable: boolean;
  internal: boolean;
  [key: string]: unknown;
}

/**
 * HTTP RPC response format.
 * Note: `succes` preserves the original typo for wire compatibility.
 */
export interface HttpRpcResponse<T = unknown> {
  uid: string;
  succes: boolean;
  error: RpcErrorObject | null;
  result: T;
}

// ============================================================
// Queue Adapter (pluggable: SQS, RabbitMQ, NATS, etc.)
// ============================================================

export interface QueueMessage {
  id: string;
  body: string;
  raw: unknown;
}

export interface QueueSendOptions {
  delaySeconds?: number;
}

export interface IQueueAdapter {
  send(
    queueUrl: string,
    body: string,
    options?: QueueSendOptions,
  ): Promise<void>;

  receive(
    queueUrl: string,
    handler: (messages: QueueMessage[]) => Promise<void>,
  ): Promise<void>;

  stop(): Promise<void>;
}

// ============================================================
// Serializable Error Interface
// ============================================================

export interface ISerializableError {
  toJSON(): RpcErrorObject;
}
