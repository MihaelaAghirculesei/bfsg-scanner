import { createServer, type Server, type Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import { scan } from './scan.js';

/** A TCP server that accepts and immediately kills every connection, so
 * navigation always fails. Counts connection attempts to prove retries
 * actually happen, rather than just trusting the loop reads correctly. */
function startFlakyServer(): Promise<{
  port: number;
  attempts: () => number;
  close: () => Promise<void>;
}> {
  let attempts = 0;
  const server: Server = createServer((socket) => {
    attempts += 1;
    socket.destroy();
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolvePromise({
        port,
        attempts: () => attempts,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe('scan', () => {
  it('reports a page that refuses the connection as a failure, not a crash', async () => {
    const flaky = await startFlakyServer();
    try {
      const result = await scan([`http://127.0.0.1:${flaky.port}/`], {
        wcagTags: ['wcag2a'],
        retries: 0,
        timeoutMs: 5_000,
      });

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]?.status).toBe('error');
    } finally {
      await flaky.close();
    }
  }, 15_000);

  it('retries once by default before giving up', async () => {
    const flaky = await startFlakyServer();
    try {
      const result = await scan([`http://127.0.0.1:${flaky.port}/`], {
        wcagTags: ['wcag2a'],
        timeoutMs: 5_000,
      });

      expect(result.pages[0]?.status).toBe('error');
      expect(flaky.attempts()).toBe(2);
    } finally {
      await flaky.close();
    }
  }, 20_000);

  it('fails a page that never finishes loading within the timeout', async () => {
    const openSockets = new Set<Socket>();
    const hanging: Server = createServer((socket) => {
      // Accept the connection but never write a response.
      openSockets.add(socket);
      socket.on('close', () => openSockets.delete(socket));
      socket.on('error', () => undefined);
    });
    await new Promise<void>((resolvePromise) => hanging.listen(0, '127.0.0.1', resolvePromise));
    const address = hanging.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;

    try {
      const result = await scan([`http://127.0.0.1:${port}/`], {
        wcagTags: ['wcag2a'],
        retries: 0,
        timeoutMs: 500,
      });

      expect(result.pages[0]?.status).toBe('error');
      if (result.pages[0]?.status === 'error') {
        expect(result.pages[0].error.toLowerCase()).toContain('timeout');
      }
    } finally {
      for (const socket of openSockets) {
        socket.destroy();
      }
      await new Promise<void>((resolvePromise) => hanging.close(() => resolvePromise()));
    }
  }, 15_000);
});
