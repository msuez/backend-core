import type { RpcModuleConfig } from './types';
import { RpcClientFactory } from './RpcClientFactory';
import { RpcClient } from './RpcClient';

/**
 * Singleton pattern.
 *
 * Manages a pool of RPC client connections.
 * Caches service instances for reuse.
 */
export class ServiceRegistry {
  private static config: RpcModuleConfig | null = null;
  private static readonly pool = new Map<string, RpcClient>();

  static configure(config: RpcModuleConfig): void {
    ServiceRegistry.config = config;
    ServiceRegistry.pool.clear();
  }

  static getService(name: string): RpcClient {
    if (!ServiceRegistry.config) {
      throw new Error(
        'ServiceRegistry not configured. Call ServiceRegistry.configure() first.',
      );
    }

    const serviceConfig = ServiceRegistry.config.services[name];
    if (!serviceConfig) {
      throw new Error(`Service "${name}" not found in configuration.`);
    }

    let client = ServiceRegistry.pool.get(name);

    if (!client) {
      client = RpcClientFactory.create(
        name,
        serviceConfig,
        ServiceRegistry.config,
      );
      ServiceRegistry.pool.set(name, client);
    }

    return client;
  }

  static clear(): void {
    ServiceRegistry.pool.clear();
    ServiceRegistry.config = null;
  }
}
