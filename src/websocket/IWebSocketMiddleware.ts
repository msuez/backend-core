import type { Socket } from 'socket.io';

export interface IWebSocketMiddleware {
  name: string;
  handle(socket: Socket, next: (err?: Error) => void): void;
}
