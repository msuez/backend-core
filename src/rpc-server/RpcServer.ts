import { EventEmitter } from 'events';
import { wrapError } from '../rpc';
import type { RpcRequest, HttpRpcResponse } from '../rpc';
import type {
  CommandResult,
  CommandDefinition,
  MiddlewareEntry,
  MiddlewarePhase,
} from './types';

type CommandHandler = (...args: unknown[]) => unknown;
type DecoratorFn = (
  fn: CommandHandler,
  namespace: string,
  cmd: string,
) => CommandHandler;

/**
 * RPC command server with middleware pipeline.
 *
 * Handles incoming RPC requests by dispatching to registered commands.
 * Supports middleware at multiple phases: pre, context, params, resolved, rejected, all.
 */
export class RpcServer extends EventEmitter {
  private readonly _commands: CommandDefinition[] = [];
  private readonly _middlewares: MiddlewareEntry[] = [];

  use(
    name: string,
    phase: MiddlewarePhase | ((...args: unknown[]) => unknown),
    callback?: (...args: unknown[]) => unknown,
  ): this {
    if (typeof phase === 'function') {
      callback = phase;
      phase = 'all';
    }

    this._middlewares.push({
      name,
      phase: phase as MiddlewarePhase,
      callback: callback!,
    });

    return this;
  }

  private async resolveResponse(
    phase: string,
    value: unknown,
    body: RpcRequest,
  ): Promise<unknown> {
    let resolved = value;

    for (const middleware of this._middlewares) {
      if (middleware.phase === 'all' || middleware.phase === phase) {
        try {
          resolved = await Promise.resolve(
            middleware.callback(resolved, body),
          );
        } catch {
          // Middleware errors are swallowed to prevent pipeline corruption
        }
      }
    }

    return resolved;
  }

  resolveCommandParts(cmdname: string): { namespace: string; cmd: string } {
    const colonIdx = cmdname.indexOf(':');
    if (colonIdx !== -1) {
      return {
        namespace: cmdname.substring(0, colonIdx),
        cmd: cmdname.substring(colonIdx + 1),
      };
    }
    return { namespace: 'default', cmd: cmdname };
  }

  async resolveCommand(
    body: RpcRequest,
    response: unknown,
  ): Promise<CommandResult> {
    const rresponse = await this.resolveResponse('resolved', response, body);

    const data: HttpRpcResponse = {
      uid: ((body as unknown) as Record<string, unknown>).uid as string ?? '',
      succes: true,
      error: null,
      result: rresponse,
    };

    return { body, data };
  }

  async getMiddlewareContext(
    mwName: string,
    body: RpcRequest,
  ): Promise<unknown> {
    const mw = this._middlewares.find((m) => m.name === mwName);
    if (!mw) {
      throw new Error(`Middleware ${mwName} not found.`);
    }
    return mw.callback(body, this);
  }

  async rejectCommand(
    body: RpcRequest,
    error: unknown,
  ): Promise<CommandResult> {
    const rerror = await this.resolveResponse('rejected', error, body);
    const errObject = wrapError(rerror);

    const data: HttpRpcResponse = {
      uid: ((body as unknown) as Record<string, unknown>).uid as string ?? '',
      succes: false,
      error: errObject,
      result: undefined as unknown,
    };

    return { body, data };
  }

  async executeCommand(body: RpcRequest): Promise<CommandResult> {
    const { namespace, cmd } = this.resolveCommandParts(body.cmd);
    const lcommand = this.findCommand(namespace, cmd);

    if (!lcommand) {
      return this.rejectCommand(
        body,
        new Error(`Command ${namespace}:${cmd} does not exist`),
      );
    }

    let processedBody = body;
    for (const mw of this._middlewares.filter((m) => m.phase === 'pre')) {
      processedBody = (await Promise.resolve(
        mw.callback(processedBody),
      )) as RpcRequest;
    }

    let params: unknown[] = processedBody.params;

    if (lcommand.contextuable && Array.isArray(lcommand.contextuable)) {
      const contextMwNames = this._middlewares
        .filter((m) => m.phase === 'context')
        .map((m) => m.name);

      const isNullContext =
        lcommand.contextuable.length === 1 &&
        lcommand.contextuable[0] === null;

      if (!isNullContext && lcommand.contextuable.length > 0) {
        const newParams = await Promise.all(
          (lcommand.contextuable as string[]).map((contextName) => {
            if (contextMwNames.includes(contextName)) {
              return this.getMiddlewareContext(contextName, processedBody);
            }
            return (processedBody.context as Record<string, unknown>)?.[
              contextName
            ];
          }),
        );

        params = [...newParams, ...params];
      } else if (!isNullContext) {
        params = [processedBody.context || {}, ...params];
      }
    }

    for (const mw of this._middlewares.filter(
      (m) => m.phase === 'params',
    )) {
      params = (await Promise.resolve(
        mw.callback(...params),
      )) as unknown[];
    }

    try {
      const result = await Promise.resolve(lcommand.func(...params));
      return this.resolveCommand(processedBody, result);
    } catch (e) {
      return this.rejectCommand(processedBody, e);
    }
  }

  findCommand(
    namespace: string,
    cmd: string,
  ): CommandDefinition | undefined {
    return this._commands.find(
      (c) => c.namespace === namespace && c.cmd === cmd,
    );
  }

  defineCommand(
    namespace: string,
    cmd?: string | CommandHandler | (string | CommandHandler | DecoratorFn)[],
    func?: CommandHandler | (string | CommandHandler | DecoratorFn)[],
  ): void {
    let contextuable: string[] | false = false;
    let decorators: DecoratorFn[] = [];

    if (typeof cmd === 'function' || Array.isArray(cmd)) {
      func = cmd;
      const parts = this.resolveCommandParts(namespace);
      cmd = parts.cmd;
      namespace = parts.namespace;
    }

    if (Array.isArray(func)) {
      const arr = [...func];
      const handler = arr.pop() as CommandHandler;

      const contextNames: string[] = [];
      const decs: DecoratorFn[] = [];

      while (arr.length > 0) {
        const item = arr.pop()!;
        if (typeof item === 'function') {
          decs.unshift(item as DecoratorFn);
        } else {
          arr.push(item);
          break;
        }
      }

      contextNames.push(...(arr as string[]));
      contextuable = contextNames;
      decorators = decs;
      func = handler;
    }

    let finalFunc = func as CommandHandler;
    if (decorators.length > 0) {
      finalFunc = decorators.reduce<CommandHandler>((f, d) => {
        const nf = d(f, namespace, cmd as string);
        if (typeof nf !== 'function') {
          throw new Error('Result of decorator must be a function');
        }
        return nf;
      }, finalFunc);
    }

    if (this.findCommand(namespace, cmd as string)) {
      throw new Error(`${namespace}:${cmd} already defined`);
    }

    this._commands.push({
      namespace,
      cmd: cmd as string,
      func: finalFunc,
      contextuable,
    });
  }

  define(
    namespace: string | Record<string, unknown>,
    obj?: Record<string, unknown> | CommandHandler | (string | CommandHandler)[],
    nested = false,
  ): void {
    if (typeof namespace !== 'string') {
      obj = namespace;
      namespace = '';
    }

    if ((typeof obj === 'function' || Array.isArray(obj)) && namespace) {
      this.defineCommand(
        namespace,
        obj as CommandHandler | (string | CommandHandler)[],
      );
      return;
    }

    if (
      !Array.isArray(obj) &&
      typeof obj === 'object' &&
      obj !== null &&
      namespace
    ) {
      for (const fn of Object.keys(obj)) {
        const val = obj[fn];
        if (typeof val === 'function' || Array.isArray(val)) {
          this.defineCommand(
            namespace,
            fn,
            val as CommandHandler | (string | CommandHandler)[],
          );
        } else {
          throw new Error(`${fn} must be a function`);
        }
      }
      return;
    }

    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj) && !namespace && !nested) {
      for (const fn of Object.keys(obj)) {
        const val = (obj as Record<string, unknown>)[fn];
        if (typeof val === 'function') {
          this.defineCommand(fn, val as CommandHandler);
        } else if (typeof val === 'object' && val !== null) {
          this.define(fn, val as Record<string, unknown>, true);
        } else {
          throw new Error(`${fn} must be a function`);
        }
      }
      return;
    }

    throw new Error('Nothing to add');
  }
}
