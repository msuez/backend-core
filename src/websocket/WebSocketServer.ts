import { Server, type Socket, type Namespace } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { IWebSocketEvents } from './IWebSocketEvents';
import type { IWebSocketServerConfig } from './IWebSocketServerConfig';
import type { IWebSocketMiddleware } from './IWebSocketMiddleware';
import type { IClosable } from '../shutdown';
import { Logger } from '../logger';

export class WebSocketServer<TEvents extends IWebSocketEvents = IWebSocketEvents> implements IClosable {
  readonly name = 'WebSocket server';
  private readonly io: Server;
  private readonly logger = new Logger('WebSocket');

  constructor(httpServer: HttpServer, config: IWebSocketServerConfig = {}) {
    this.io = new Server<
      TEvents['clientToServer'],
      TEvents['serverToClient'],
      TEvents['interServer'],
      TEvents['socketData']
    >(httpServer, {
      cors: config.cors,
      pingInterval: config.pingInterval ?? 25000,
      pingTimeout: config.pingTimeout ?? 20000,
      path: config.path ?? '/socket.io',
      cleanupEmptyChildNamespaces: config.cleanupEmptyChildNamespaces ?? true,
      connectionStateRecovery: config.connectionStateRecovery ? {
        maxDisconnectionDuration: config.connectionStateRecovery.maxDisconnectionDuration ?? 120000,
        skipMiddlewares: config.connectionStateRecovery.skipMiddlewares ?? true,
      } : undefined,
    });

    this.setupLogging();
    this.logger.info('WebSocket server initialized');
  }

  // --- Namespace ---

  namespace(name: string): Namespace {
    return this.io.of(name);
  }

  // --- Middleware ---

  use(middleware: IWebSocketMiddleware): void {
    this.io.use((socket, next) => {
      this.logger.debug(`Middleware "${middleware.name}" — socket ${socket.id}`);
      middleware.handle(socket as Socket, next);
    });
  }

  useOn(namespaceName: string, middleware: IWebSocketMiddleware): void {
    this.namespace(namespaceName).use((socket, next) => {
      this.logger.debug(`Middleware "${middleware.name}" on ${namespaceName} — socket ${socket.id}`);
      middleware.handle(socket as Socket, next);
    });
  }

  // --- Connection ---

  onConnection(handler: (socket: Socket) => void): void {
    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);
      handler(socket as Socket);
    });
  }

  onConnectionTo(namespaceName: string, handler: (socket: Socket) => void): void {
    this.namespace(namespaceName).on('connection', (socket) => {
      this.logger.info(`Client connected to ${namespaceName}: ${socket.id}`);
      handler(socket as Socket);
    });
  }

  // --- Broadcast ---

  broadcast(event: string, ...args: unknown[]): void {
    this.io.emit(event, ...args);
  }

  broadcastTo(namespaceName: string, event: string, ...args: unknown[]): void {
    this.namespace(namespaceName).emit(event, ...args);
  }

  toRoom(room: string, event: string, ...args: unknown[]): void {
    this.io.to(room).emit(event, ...args);
  }

  toRoomIn(namespaceName: string, room: string, event: string, ...args: unknown[]): void {
    this.namespace(namespaceName).to(room).emit(event, ...args);
  }

  // --- Metrics ---

  getConnectionCount(): number {
    return this.io.engine.clientsCount;
  }

  getRooms(namespaceName?: string): Map<string, Set<string>> {
    const ns = namespaceName ? this.namespace(namespaceName) : this.io.sockets;
    return ns.adapter.rooms;
  }

  // --- Escape hatch ---

  getIO(): Server {
    return this.io;
  }

  // --- IClosable ---

  async close(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.io.close(() => {
        this.logger.info('WebSocket server closed');
        resolve();
      });
    });
  }

  // --- Internal ---

  private setupLogging(): void {
    this.io.on('connection', (socket) => {
      socket.on('disconnect', (reason: string) => {
        this.logger.info(`Client disconnected: ${socket.id} (${reason})`);
      });

      socket.on('error', (err: Error) => {
        this.logger.error(`Socket error: ${socket.id}`, { error: err.message });
      });
    });
  }
}
