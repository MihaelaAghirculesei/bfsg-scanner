import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { run } from './run.js';

const FIXTURES_SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/site');

let dir: string;
let server: StaticServer;
let browser: Browser;

beforeAll(async () => {
  server = await startStaticServer(FIXTURES_SITE_DIR);
  browser = await chromium.launch();
});

afterAll(async () => {
  await server.close();
  await browser.close();
});

// Every run() here shares the one browser above; run() forwards it to
// scan() and never closes an injected browser.
const runCli = (argv: readonly string[]): Promise<number> => run(argv, { browser });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-cli-test-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeConfig(baseUrl: string, extra = ''): string {
  const path = join(dir, 'bfsg.config.yaml');
  // outputDir points at the per-test temp dir so a run never writes into the repo.
  writeFileSync(path, `baseUrl: ${baseUrl}\noutputDir: ${JSON.stringify(dir)}\n${extra}`, 'utf8');
  return path;
}

function readReport(): {
  schemaVersion: number;
  target: { baseUrl: string };
  summary: { pagesScanned: number; totalViolations: number };
  verdict: {
    violationsAtOrAboveThreshold: number;
    unrankedViolations: number;
    passed: boolean;
  };
  pages: unknown[];
} {
  return JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
}

function readHtmlReport(): string {
  return readFileSync(join(dir, 'report.html'), 'utf8');
}

describe('run', () => {
  it('returns 0 for a valid config that scans cleanly', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await expect(runCli(['--config', path])).resolves.toBe(0);
  }, 30_000);

  // contrast.html carries exactly one color-contrast violation, impact
  // "serious" (see fixtures/SITE_TRUTH.md) - the threshold's own boundary.
  it('returns 1 when a violation reaches the failOn threshold', async () => {
    const path = writeConfig(`${server.url}/contrast.html`, 'failOn: serious\n');

    await expect(runCli(['--config', path])).resolves.toBe(1);

    const report = readReport();
    expect(report.verdict).toEqual({
      violationsAtOrAboveThreshold: 1,
      unrankedViolations: 0,
      passed: false,
    });
  }, 30_000);

  it('returns 0 when the same violation sits below the failOn threshold', async () => {
    const path = writeConfig(`${server.url}/contrast.html`, 'failOn: critical\n');

    await expect(runCli(['--config', path])).resolves.toBe(0);

    const report = readReport();
    expect(report.summary.totalViolations).toBe(1);
    expect(report.verdict.passed).toBe(true);
  }, 30_000);

  it('writes a JSON report describing the scan', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await expect(runCli(['--config', path])).resolves.toBe(0);

    const report = readReport();
    expect(report.schemaVersion).toBe(1);
    expect(report.target.baseUrl).toBe(`${server.url}/clean.html`);
    expect(report.summary.pagesScanned).toBe(1);
    expect(report.summary.totalViolations).toBe(0);
    expect(report.pages).toHaveLength(1);
  }, 30_000);

  it('writes an HTML report in the configured language alongside the JSON', async () => {
    const path = writeConfig(
      `${server.url}/contrast.html`,
      'reportLanguage: en\nfailOn: critical\n',
    );

    await expect(runCli(['--config', path])).resolves.toBe(0);

    const html = readHtmlReport();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('color-contrast');
    expect(html).toContain('1.4.3');
  }, 30_000);

  it('defaults the HTML report to German', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await expect(runCli(['--config', path])).resolves.toBe(0);

    expect(readHtmlReport()).toContain('<html lang="de">');
  }, 30_000);

  it('returns 2 when the config file is missing', async () => {
    const path = join(dir, 'missing.yaml');

    await expect(runCli(['--config', path])).resolves.toBe(2);
  });

  it('returns 2 when the config is invalid', async () => {
    const path = join(dir, 'bfsg.config.yaml');
    writeFileSync(path, 'maxPages: 10\n', 'utf8');

    await expect(runCli(['--config', path])).resolves.toBe(2);
  });

  it('returns 2 when --config is passed without a path', async () => {
    await expect(runCli(['--config'])).resolves.toBe(2);
  });

  it('returns 3 when the target page cannot be reached', async () => {
    const path = writeConfig('http://127.0.0.1:1/');

    await expect(runCli(['--config', path])).resolves.toBe(3);
  }, 30_000);

  it('returns 3 when discovery finds no scannable pages', async () => {
    const blockedDir = mkdtempSync(join(tmpdir(), 'bfsg-cli-blocked-'));
    writeFileSync(join(blockedDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
    writeFileSync(join(blockedDir, 'index.html'), '<!doctype html><title>x</title>', 'utf8');
    const blockedServer = await startStaticServer(blockedDir);
    try {
      const path = writeConfig(blockedServer.url);

      await expect(runCli(['--config', path])).resolves.toBe(3);
    } finally {
      await blockedServer.close();
      rmSync(blockedDir, { recursive: true, force: true });
    }
  }, 30_000);
});
