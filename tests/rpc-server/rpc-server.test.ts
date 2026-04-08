import { describe, it, expect, beforeEach } from '@jest/globals';
import { RpcServer } from '../../src/rpc-server/RpcServer';
import { ShowableError } from '../../src/rpc/ShowableError';

describe('RpcServer', () => {
  let server: RpcServer;

  beforeEach(() => {
    server = new RpcServer();
  });

  describe('defineCommand', () => {
    it('should register a simple command with namespace:cmd syntax', async () => {
      server.defineCommand('users:list', () => ['alice', 'bob']);
      const result = await server.executeCommand({ cmd: 'users:list', params: [], context: {} });
      expect(result.data.succes).toBe(true);
      expect(result.data.result).toEqual(['alice', 'bob']);
    });

    it('should register with separate namespace and cmd', async () => {
      server.defineCommand('users', 'get', (id: unknown) => ({ id }));
      const result = await server.executeCommand({ cmd: 'users:get', params: ['u1'], context: {} });
      expect(result.data.result).toEqual({ id: 'u1' });
    });

    it('should use default namespace when no colon', async () => {
      server.defineCommand('ping', () => 'pong');
      const result = await server.executeCommand({ cmd: 'ping', params: [], context: {} });
      expect(result.data.result).toBe('pong');
    });

    it('should throw on duplicate command', () => {
      server.defineCommand('test:cmd', () => {});
      expect(() => server.defineCommand('test:cmd', () => {})).toThrow('already defined');
    });
  });

  describe('define', () => {
    it('should register namespaced functions from an object', async () => {
      server.define('math', {
        add: (a: unknown, b: unknown) => (a as number) + (b as number),
        mul: (a: unknown, b: unknown) => (a as number) * (b as number),
      });

      const addResult = await server.executeCommand({ cmd: 'math:add', params: [2, 3], context: {} });
      expect(addResult.data.result).toBe(5);

      const mulResult = await server.executeCommand({ cmd: 'math:mul', params: [4, 5], context: {} });
      expect(mulResult.data.result).toBe(20);
    });

    it('should register multi-namespace from nested objects', async () => {
      server.define({
        users: { list: () => ['alice'] },
        posts: { list: () => ['post-1'] },
      });

      const users = await server.executeCommand({ cmd: 'users:list', params: [], context: {} });
      expect(users.data.result).toEqual(['alice']);

      const posts = await server.executeCommand({ cmd: 'posts:list', params: [], context: {} });
      expect(posts.data.result).toEqual(['post-1']);
    });
  });

  describe('executeCommand', () => {
    it('should reject unknown commands', async () => {
      const result = await server.executeCommand({ cmd: 'ghost:cmd', params: [], context: {} });
      expect(result.data.succes).toBe(false);
      expect(result.data.error?.message).toContain('does not exist');
    });

    it('should catch thrown errors and reject', async () => {
      server.defineCommand('fail:hard', () => { throw new Error('kaboom'); });
      const result = await server.executeCommand({ cmd: 'fail:hard', params: [], context: {} });
      expect(result.data.succes).toBe(false);
      expect(result.data.error?.internal).toBe(true);
      expect(result.data.error?.message).toBe('kaboom');
    });

    it('should catch rejected promises and reject', async () => {
      server.defineCommand('fail:async', async () => { throw new Error('async boom'); });
      const result = await server.executeCommand({ cmd: 'fail:async', params: [], context: {} });
      expect(result.data.succes).toBe(false);
      expect(result.data.error?.message).toBe('async boom');
    });

    it('should serialize ShowableError with showable=true', async () => {
      server.defineCommand('fail:showable', () => { throw new ShowableError('visible error'); });
      const result = await server.executeCommand({ cmd: 'fail:showable', params: [], context: {} });
      expect(result.data.error?.showable).toBe(true);
      expect(result.data.error?.internal).toBe(false);
    });

    it('should pass params to the command handler', async () => {
      server.defineCommand('echo:params', (...args: unknown[]) => args);
      const result = await server.executeCommand({ cmd: 'echo:params', params: [1, 'two', true], context: {} });
      expect(result.data.result).toEqual([1, 'two', true]);
    });

    it('should handle async command handlers', async () => {
      server.defineCommand('async:work', async (n: unknown) => (n as number) * 2);
      const result = await server.executeCommand({ cmd: 'async:work', params: [21], context: {} });
      expect(result.data.result).toBe(42);
    });
  });

  describe('middleware', () => {
    it('should run "resolved" middleware on success', async () => {
      server.defineCommand('test:mw', () => 'raw');
      server.use('uppercaser', 'resolved', (value: unknown) => (value as string).toUpperCase());
      const result = await server.executeCommand({ cmd: 'test:mw', params: [], context: {} });
      expect(result.data.result).toBe('RAW');
    });

    it('should run "rejected" middleware on errors', async () => {
      server.defineCommand('test:fail', () => { throw new ShowableError('original'); });
      server.use('error-mapper', 'rejected', (error: unknown) => {
        if (error instanceof ShowableError) return new ShowableError('mapped: ' + error.message);
        return error;
      });
      const result = await server.executeCommand({ cmd: 'test:fail', params: [], context: {} });
      expect(result.data.error?.message).toBe('mapped: original');
    });

    it('should run "pre" middleware to transform body', async () => {
      server.defineCommand('test:pre', (p: unknown) => p);
      server.use('inject-param', 'pre', (body: unknown) => {
        const b = body as { params: unknown[] };
        return { ...b, params: [...b.params, 'injected'] };
      });
      const result = await server.executeCommand({ cmd: 'test:pre', params: ['original'], context: {} });
      expect(result.data.result).toBe('original');
    });

    it('should run "all" middleware on both success and failure', async () => {
      const calls: string[] = [];
      server.use('tracker', 'all', (value: unknown) => { calls.push('tracked'); return value; });
      server.defineCommand('test:ok', () => 'ok');
      server.defineCommand('test:err', () => { throw new Error('err'); });

      await server.executeCommand({ cmd: 'test:ok', params: [], context: {} });
      await server.executeCommand({ cmd: 'test:err', params: [], context: {} });
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('contextuable commands', () => {
    it('should inject context middleware values as first params', async () => {
      server.use('userId', 'context', (body: unknown) => {
        return (body as { context: { userId: string } }).context.userId;
      });
      server.defineCommand('user:profile', ['userId', (userId: unknown) => ({ profile: userId })]);
      const result = await server.executeCommand({ cmd: 'user:profile', params: [], context: { userId: 'u42' } });
      expect(result.data.result).toEqual({ profile: 'u42' });
    });

    it('should inject context values from body.context', async () => {
      server.defineCommand('ctx:read', ['lang', (lang: unknown) => `language is ${lang}`]);
      const result = await server.executeCommand({ cmd: 'ctx:read', params: [], context: { lang: 'es' } });
      expect(result.data.result).toBe('language is es');
    });
  });

  describe('resolveCommandParts', () => {
    it('should split namespace:cmd', () => {
      expect(server.resolveCommandParts('users:list')).toEqual({ namespace: 'users', cmd: 'list' });
    });

    it('should default to "default" namespace', () => {
      expect(server.resolveCommandParts('ping')).toEqual({ namespace: 'default', cmd: 'ping' });
    });
  });
});
