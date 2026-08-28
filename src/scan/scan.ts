import { AxeBuilder } from '@axe-core/playwright';
import type { IncompleteResult, Result } from 'axe-core';
import { type Browser, chromium } from 'playwright';
import { runWithConcurrency } from '../shared/pool.js';
import { HostRateLimiter } from '../shared/rate-limiter.js';
import { USER_AGENT } from '../shared/user-agent.js';
import type { PageScanResult, ScanDeps, ScanFinding, ScanOptions, ScanResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_HOST_RATE_LIMIT_MS = 1_000;

export async function scan(
  urls: readonly string[],
  options: ScanOptions,
  deps: ScanDeps = {},
): Promise<ScanResult> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const rateLimiter = new HostRateLimiter(options.hostRateLimitMs ?? DEFAULT_HOST_RATE_LIMIT_MS);

  const browser = deps.browser ?? (await chromium.launch());
  const launchedHere = deps.browser === undefined;
  try {
    const pages = await runWithConcurrency(urls, concurrency, (url) =>
      scanPage(browser, url, options, rateLimiter),
    );
    return { pages };
  } finally {
    if (launchedHere) {
      await browser.close();
    }
  }
}

async function scanPage(
  browser: Browser,
  url: string,
  options: ScanOptions,
  rateLimiter: HostRateLimiter,
): Promise<PageScanResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const host = safeHost(url);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (host !== null) {
      await rateLimiter.wait(host);
    }

    const context = await browser.newContext({ userAgent: USER_AGENT });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
      const results = await new AxeBuilder({ page }).withTags([...options.wcagTags]).analyze();
      return {
        status: 'ok',
        url,
        violations: results.violations.map(mapFinding),
        incomplete: results.incomplete.map(mapFinding),
      };
    } catch (error) {
      lastError = error;
    } finally {
      await context.close();
    }
  }

  return {
    status: 'error',
    url,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function mapFinding(result: Result | IncompleteResult): ScanFinding {
  return {
    ruleId: result.id,
    impact: result.impact ?? null,
    description: result.description,
    help: result.help,
    helpUrl: result.helpUrl,
    nodes: result.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary ?? null,
    })),
  };
}
