import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function consoleOutput(): string {
  const lines = (method: 'log' | 'warn' | 'error') =>
    vi.mocked(console[method]).mock.calls.map((args) => args.join(' '));
  return [...lines('log'), ...lines('warn'), ...lines('error')].join('\n');
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

  it('prints the breached WCAG SC and EN 301 549 clauses when there are violations', async () => {
    const path = writeConfig(`${server.url}/contrast.html`, 'failOn: critical\n');

    await runCli(['--config', path]);

    const out = consoleOutput();
    expect(out).toContain('WCAG 2.1 SC breached: 1.4.3');
    expect(out).toContain('EN 301 549 clauses breached: 9.1.4.3');
  }, 30_000);

  it('does not print a breached-clauses line for a clean scan', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await runCli(['--config', path]);

    expect(consoleOutput()).not.toContain('breached');
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

  it('writes a PDF report alongside the JSON and HTML', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await expect(runCli(['--config', path])).resolves.toBe(0);

    const pdf = readFileSync(join(dir, 'report.pdf'));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
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

describe('run — CLI arguments', () => {
  it('prints usage for --help / -h and exits 0 without scanning', async () => {
    for (const flag of ['--help', '-h']) {
      await expect(runCli([flag])).resolves.toBe(0);
    }
    const out = consoleOutput();
    expect(out).toContain('Usage:');
    expect(out).toContain('--fail-on');
    expect(out).toContain('Exit codes:');
  });

  it('prints the name and version for --version / -V and exits 0', async () => {
    await expect(runCli(['--version'])).resolves.toBe(0);
    await expect(runCli(['-V'])).resolves.toBe(0);
    expect(consoleOutput()).toMatch(/bfsg-scanner \d+\.\d+\.\d+/);
  });

  it('returns 2 on an unknown flag', async () => {
    await expect(runCli(['--nope'])).resolves.toBe(2);
  });

  it('scans a positional URL with no config file involved', async () => {
    await expect(runCli([`${server.url}/clean.html`, '--output-dir', dir])).resolves.toBe(0);

    const report = readReport();
    expect(report.target.baseUrl).toBe(`${server.url}/clean.html`);
    expect(report.summary.pagesScanned).toBe(1);
  }, 30_000);

  it('returns 2 when a URL argument and --config are both given', async () => {
    const path = writeConfig(`${server.url}/clean.html`);

    await expect(runCli([`${server.url}/clean.html`, '--config', path])).resolves.toBe(2);
  });

  it('returns 2 when more than one URL argument is given', async () => {
    await expect(runCli([`${server.url}/a`, `${server.url}/b`])).resolves.toBe(2);
  });

  it('lets --fail-on override the config threshold', async () => {
    // contrast.html is one "serious" violation; the config would fail on it.
    const path = writeConfig(`${server.url}/contrast.html`, 'failOn: serious\n');

    await expect(runCli(['--config', path, '--fail-on', 'critical'])).resolves.toBe(0);
    expect(readReport().verdict.passed).toBe(true);
  }, 30_000);

  it('returns 2 on an invalid --fail-on value', async () => {
    await expect(
      runCli([`${server.url}/clean.html`, '--fail-on', 'nope', '--output-dir', dir]),
    ).resolves.toBe(2);
  });

  it('lets --output-dir override the config directory', async () => {
    const other = mkdtempSync(join(tmpdir(), 'bfsg-cli-out-'));
    try {
      const path = writeConfig(`${server.url}/clean.html`);

      await expect(runCli(['--config', path, '--output-dir', other])).resolves.toBe(0);
      expect(existsSync(join(other, 'report.json'))).toBe(true);
      expect(existsSync(join(dir, 'report.json'))).toBe(false);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  }, 30_000);

  it('with --format json writes only the JSON report', async () => {
    await expect(
      runCli([`${server.url}/clean.html`, '--format', 'json', '--output-dir', dir]),
    ).resolves.toBe(0);

    expect(existsSync(join(dir, 'report.json'))).toBe(true);
    expect(existsSync(join(dir, 'report.html'))).toBe(false);
    expect(existsSync(join(dir, 'report.pdf'))).toBe(false);
  }, 30_000);

  it('with --format html,pdf skips the JSON report', async () => {
    await expect(
      runCli([`${server.url}/clean.html`, '--format', 'html,pdf', '--output-dir', dir]),
    ).resolves.toBe(0);

    expect(existsSync(join(dir, 'report.json'))).toBe(false);
    expect(existsSync(join(dir, 'report.html'))).toBe(true);
    expect(existsSync(join(dir, 'report.pdf'))).toBe(true);
  }, 30_000);

  it('returns 2 on an unknown --format value', async () => {
    await expect(
      runCli([`${server.url}/clean.html`, '--format', 'json,xml', '--output-dir', dir]),
    ).resolves.toBe(2);
  });

  it('lets --report-language pick the HTML language', async () => {
    await expect(
      runCli([`${server.url}/clean.html`, '--report-language', 'en', '--output-dir', dir]),
    ).resolves.toBe(0);

    expect(readHtmlReport()).toContain('<html lang="en">');
  }, 30_000);
});
