import { EventEmitter } from 'events';
import { Logger } from '../logger';

const logger = new Logger('EventBus');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventBus<TEventMap extends Record<string, any> = Record<string, never>> {
  private readonly emitter = new EventEmitter();

  emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    logger.info(`Event: ${String(event)}`, payload as Record<string, unknown>);
    this.emitter.emit(event as string, payload);
  }

  on<K extends keyof TEventMap>(event: K, handler: (payload: TEventMap[K]) => void): void {
    this.emitter.on(event as string, handler);
  }
}
