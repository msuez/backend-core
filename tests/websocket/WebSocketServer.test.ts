import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { createServer, type Server as HttpServer } from 'http';
import { WebSocketServer } from '../../src/websocket/WebSocketServer';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

let httpServer: HttpServer;
let wss: WebSocketServer;

function createHttpServer(): HttpServer {
  return createServer();
}

afterEach(async () => {
  if (wss) await wss.close();
  if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe('WebSocketServer', () => {
  it('can be instantiated with an http server', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer);

    expect(wss).toBeInstanceOf(WebSocketServer);
  });

  it('name property is "WebSocket server" (IClosable)', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer);

    expect(wss.name).toBe('WebSocket server');
  });

  it('accepts custom config', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer, {
      pingInterval: 10000,
      pingTimeout: 5000,
      path: '/ws',
      cleanupEmptyChildNamespaces: false,
      cors: { origin: 'http://localhost:3000' },
    });

    expect(wss).toBeInstanceOf(WebSocketServer);
  });

  it('accepts connectionStateRecovery config', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer, {
      connectionStateRecovery: {
        maxDisconnectionDuration: 60000,
        skipMiddlewares: false,
      },
    });

    expect(wss).toBeInstanceOf(WebSocketServer);
  });

  it('getIO() returns the socket.io Server instance', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer);

    const io = wss.getIO();
    expect(io).toBeDefined();
    expect(typeof io.on).toBe('function');
    expect(typeof io.emit).toBe('function');
  });

  it('getConnectionCount() returns 0 with no connections', () => {
    httpServer = createHttpServer();
    httpServer.listen(0);
    wss = new WebSocketServer(httpServer);

    expect(wss.getConnectionCount()).toBe(0);
  });

  it('close() resolves (IClosable contract)', async () => {
    httpServer = createHttpServer();
    httpServer.listen(0);
    wss = new WebSocketServer(httpServer);

    await expect(wss.close()).resolves.toBeUndefined();
  });

  it('use() does not throw when registering middleware', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer);

    expect(() => {
      wss.use({
        name: 'test-auth',
        handle: (_socket, next) => next(),
      });
    }).not.toThrow();
  });

  it('useOn() does not throw when registering namespace middleware', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer);

    expect(() => {
      wss.useOn('/admin', {
        name: 'admin-auth',
        handle: (_socket, next) => next(),
      });
    }).not.toThrow();
  });

  it('namespace() returns a Namespace instance', () => {
    httpServer = createHttpServer();
    wss = new WebSocketServer(httpServer);

    const ns = wss.namespace('/chat');
    expect(ns).toBeDefined();
    expect(typeof ns.on).toBe('function');
    expect(typeof ns.emit).toBe('function');
  });

  it('broadcast methods do not throw on empty server', () => {
    httpServer = createHttpServer();
    httpServer.listen(0);
    wss = new WebSocketServer(httpServer);

    expect(() => wss.broadcast('test', { data: 1 })).not.toThrow();
    expect(() => wss.broadcastTo('/chat', 'test', { data: 1 })).not.toThrow();
    expect(() => wss.toRoom('room1', 'test', { data: 1 })).not.toThrow();
    expect(() => wss.toRoomIn('/chat', 'room1', 'test', { data: 1 })).not.toThrow();
  });
});
