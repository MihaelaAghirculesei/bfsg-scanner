import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { run } from './run.js';

const FIXTURES_SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/site');

let dir: string;
let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(FIXTURES_SITE_DIR);
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-cli-test-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeConfig(baseUrl: string): string {
  const path = join(dir, 'bfsg.config.yaml');
  writeFileSync(path, `baseUrl: ${baseUrl}\n`, 'utf8');
  return path;
}

describe('run', () => {
  it('returns 0 for a valid config that scans cleanly', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await expect(run(['--config', path])).resolves.toBe(0);
  }, 30_000);

  it('returns 2 when the config file is missing', async () => {
    const path = join(dir, 'missing.yaml');

    await expect(run(['--config', path])).resolves.toBe(2);
  });

  it('returns 2 when the config is invalid', async () => {
    const path = join(dir, 'bfsg.config.yaml');
    writeFileSync(path, 'maxPages: 10\n', 'utf8');

    await expect(run(['--config', path])).resolves.toBe(2);
  });

  it('returns 2 when --config is passed without a path', async () => {
    await expect(run(['--config'])).resolves.toBe(2);
  });

  it('returns 3 when the target page cannot be reached', async () => {
    const path = writeConfig('http://127.0.0.1:1/');

    await expect(run(['--config', path])).resolves.toBe(3);
  }, 30_000);
});
