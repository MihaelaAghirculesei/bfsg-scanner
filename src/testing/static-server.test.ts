import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type StaticServer, startStaticServer } from './static-server.js';

let dir: string;
let server: StaticServer;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-static-server-test-'));
  writeFileSync(join(dir, 'page.html'), '<p>hello</p>', 'utf8');
  server = await startStaticServer(dir);
});

afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('startStaticServer', () => {
  it('serves an existing file with the right content type', async () => {
    const response = await fetch(`${server.url}/page.html`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe('<p>hello</p>');
  });

  it('returns 404 for a missing file', async () => {
    const response = await fetch(`${server.url}/missing.html`);

    expect(response.status).toBe(404);
  });

  it('refuses to serve paths that escape the root', async () => {
    const response = await fetch(`${server.url}/../../secret.txt`);

    expect([403, 404]).toContain(response.status);
  });
});
