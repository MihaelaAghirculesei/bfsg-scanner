import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from './run.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-cli-test-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('run', () => {
  it('returns 0 for a valid config', () => {
    const path = join(dir, 'bfsg.config.yaml');
    writeFileSync(path, 'baseUrl: https://example.de\n', 'utf8');

    expect(run(['--config', path])).toBe(0);
  });

  it('returns 2 when the config file is missing', () => {
    const path = join(dir, 'missing.yaml');

    expect(run(['--config', path])).toBe(2);
  });

  it('returns 2 when the config is invalid', () => {
    const path = join(dir, 'bfsg.config.yaml');
    writeFileSync(path, 'maxPages: 10\n', 'utf8');

    expect(run(['--config', path])).toBe(2);
  });

  it('returns 2 when --config is passed without a path', () => {
    expect(run(['--config'])).toBe(2);
  });
});
