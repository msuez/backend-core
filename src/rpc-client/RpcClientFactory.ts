import type { ServiceConfig, RpcModuleConfig } from './types';
import { HttpProducer } from './HttpProducer';
import { QueueProducer } from './QueueProducer';
import { RpcClient } from './RpcClient';

/**
 * Factory Method pattern.
 *
 * Creates an RpcClient with the appropriate producer based on service configuration.
 * Handles tunneling: queue services with `tunneled` config route through
 * the tunneled service's HTTP endpoint.
 */
export class RpcClientFactory {
  static create(
    name: string,
    config: ServiceConfig,
    allServices?: RpcModuleConfig,
  ): RpcClient {
    if (config.type === 'http') {
      if (!config.http) {
        throw new Error(
          `Service "${name}": type is "http" but no http config provided`,
        );
      }

      const producer = new HttpProducer(config.http);
      return new RpcClient(name, producer, 'http');
    }

    if (config.type === 'queue') {
      if (!config.queue) {
        throw new Error(
          `Service "${name}": type is "queue" but no queue config provided`,
        );
      }

      if (config.queue.tunneled && allServices) {
        const tunneledName = config.queue.tunneled;
        const tunneledConfig = allServices.services[tunneledName];

        if (!tunneledConfig || !tunneledConfig.http) {
          throw new Error(
            `Service "${name}": tunneled service "${tunneledName}" not found or has no HTTP config`,
          );
        }

        const producer = new HttpProducer(tunneledConfig.http);
        return new RpcClient(name, producer, 'http');
      }

      const producer = new QueueProducer({
        adapter: config.queue.adapter,
        queueUrl: config.queue.queueUrl,
      });
      return new RpcClient(name, producer, 'queue');
    }

    throw new Error(`Service "${name}": unknown transport type "${config.type}"`);
  }
}
