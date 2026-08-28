import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer, type Server, type Socket } from 'node:net';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { USER_AGENT } from '../shared/user-agent.js';
import { scan } from './scan.js';

// One browser for the whole file: scan() accepts an injected browser and
// will not close it, so every test here shares a single Chromium launch
// instead of paying for one each. Contexts stay per-page and isolated.
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

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

type DelayEvent = 'start' | 'end';

/** Serves a minimal valid page after `delayMs`, reporting request
 * start/end timestamps via `onEvent` so a test can prove two servers'
 * requests overlapped in time — a direct proof of concurrency, immune to
 * the wall-clock flakiness of comparing absolute durations. */
function startDelayedHtmlServer(
  delayMs: number,
  onEvent: (event: DelayEvent) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server: HttpServer = createHttpServer((_req, res) => {
    onEvent('start');
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html lang="en"><head><title>t</title></head><body></body></html>');
      onEvent('end');
    }, delayMs);
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolvePromise({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe('scan', () => {
  it('reports a page that refuses the connection as a failure, not a crash', async () => {
    const flaky = await startFlakyServer();
    try {
      const result = await scan(
        [`http://127.0.0.1:${flaky.port}/`],
        { wcagTags: ['wcag2a'], retries: 0, timeoutMs: 5_000, hostRateLimitMs: 0 },
        { browser },
      );

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]?.status).toBe('error');
    } finally {
      await flaky.close();
    }
  }, 15_000);

  it('retries once by default before giving up', async () => {
    const flaky = await startFlakyServer();
    try {
      const result = await scan(
        [`http://127.0.0.1:${flaky.port}/`],
        { wcagTags: ['wcag2a'], timeoutMs: 5_000, hostRateLimitMs: 0 },
        { browser },
      );

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
      const result = await scan(
        [`http://127.0.0.1:${port}/`],
        { wcagTags: ['wcag2a'], retries: 0, timeoutMs: 500, hostRateLimitMs: 0 },
        { browser },
      );

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

  it('scans different hosts concurrently, not sequentially', async () => {
    const events: { server: 'A' | 'B'; event: DelayEvent; at: number }[] = [];
    const delayMs = 400;
    const serverA = await startDelayedHtmlServer(delayMs, (event) =>
      events.push({ server: 'A', event, at: Date.now() }),
    );
    const serverB = await startDelayedHtmlServer(delayMs, (event) =>
      events.push({ server: 'B', event, at: Date.now() }),
    );

    try {
      const result = await scan(
        [serverA.url, serverB.url],
        { wcagTags: ['wcag2a'], concurrency: 2, hostRateLimitMs: 0 },
        { browser },
      );

      expect(result.pages.every((page) => page.status === 'ok')).toBe(true);

      const aEnd = events.find((e) => e.server === 'A' && e.event === 'end')?.at;
      const bStart = events.find((e) => e.server === 'B' && e.event === 'start')?.at;
      expect(aEnd).toBeDefined();
      expect(bStart).toBeDefined();
      // B's request started before A's finished: their requests overlapped.
      expect(bStart as number).toBeLessThan(aEnd as number);
    } finally {
      await serverA.close();
      await serverB.close();
    }
  }, 20_000);

  it('serializes requests to the same host even with concurrency > 1', async () => {
    const rateLimitMs = 500;
    const server = await startDelayedHtmlServer(0, () => undefined);

    try {
      const start = Date.now();
      const result = await scan(
        [server.url, server.url, server.url],
        { wcagTags: ['wcag2a'], concurrency: 3, hostRateLimitMs: rateLimitMs },
        { browser },
      );
      const elapsed = Date.now() - start;

      expect(result.pages.every((page) => page.status === 'ok')).toBe(true);
      // 3 requests to the same host, spaced by rateLimitMs, means at least
      // two gaps must elapse regardless of how fast each page itself loads.
      expect(elapsed).toBeGreaterThanOrEqual(rateLimitMs * 2);
    } finally {
      await server.close();
    }
  }, 20_000);

  it('sends the identifiable User-Agent on the actual browser navigation', async () => {
    let receivedUserAgent: string | undefined;
    const server: HttpServer = createHttpServer((req, res) => {
      receivedUserAgent = req.headers['user-agent'];
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html lang="en"><head><title>t</title></head><body></body></html>');
    });
    await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;

    try {
      const result = await scan(
        [`http://127.0.0.1:${port}/`],
        { wcagTags: ['wcag2a'], hostRateLimitMs: 0 },
        { browser },
      );

      expect(result.pages[0]?.status).toBe('ok');
      expect(receivedUserAgent).toBe(USER_AGENT);
    } finally {
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    }
  }, 15_000);
});
