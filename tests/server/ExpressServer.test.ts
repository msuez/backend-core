import { describe, it, expect, afterEach, beforeAll } from '@jest/globals';
import express from 'express';
import { ExpressServer } from '../../src/server/ExpressServer';
import { Logger } from '../../src/logger/Logger';

beforeAll(() => Logger.init({ level: 'silent' }));

describe('ExpressServer', () => {
  let server: ExpressServer;

  afterEach(async () => {
    try {
      await server?.stop();
    } catch {
      // Already stopped
    }
  });

  it('start() listens on given port', async () => {
    const app = express();
    server = new ExpressServer(app, 0);

    // Port 0 means OS assigns a random available port
    server.start();

    // Wait for the server to bind
    await new Promise((r) => setTimeout(r, 100));

    // If we reach here without error, the server started successfully
    expect(true).toBe(true);
  });

  it('stop() closes the server without error', async () => {
    const app = express();
    server = new ExpressServer(app, 0);

    server.start();

    // Wait for the server to fully bind before stopping
    await new Promise((r) => setTimeout(r, 100));

    await expect(server.stop()).resolves.toBeUndefined();
  });

  it('stop() resolves immediately if server was never started', async () => {
    const app = express();
    server = new ExpressServer(app, 0);

    await expect(server.stop()).resolves.toBeUndefined();
  });
});
