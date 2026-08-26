import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchWithUserAgent, USER_AGENT } from './user-agent.js';

let server: Server;
let url: string;
let receivedUserAgent: string | undefined;
let receivedTestHeader: string | undefined;

beforeEach(async () => {
  server = createServer((req, res) => {
    receivedUserAgent = req.headers['user-agent'];
    receivedTestHeader = req.headers['x-test'] as string | undefined;
    res.writeHead(200);
    res.end('ok');
  });
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  url = `http://127.0.0.1:${port}/`;
});

afterEach(async () => {
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
});

describe('fetchWithUserAgent', () => {
  it('sends the identifiable User-Agent header', async () => {
    await fetchWithUserAgent(url);

    expect(receivedUserAgent).toBe(USER_AGENT);
  });

  it('preserves other headers passed in init', async () => {
    await fetchWithUserAgent(url, { headers: { 'X-Test': 'yes' } });

    expect(receivedUserAgent).toBe(USER_AGENT);
    expect(receivedTestHeader).toBe('yes');
  });
});
