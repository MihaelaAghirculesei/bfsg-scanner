import { AxeBuilder } from '@axe-core/playwright';
import type { IncompleteResult, Result } from 'axe-core';
import { type Browser, chromium } from 'playwright';
import type { PageScanResult, ScanFinding, ScanOptions, ScanResult } from './types.js';

export async function scan(urls: readonly string[], options: ScanOptions): Promise<ScanResult> {
  const browser = await chromium.launch();
  try {
    const pages: PageScanResult[] = [];
    for (const url of urls) {
      pages.push(await scanPage(browser, url, options));
    }
    return { pages };
  } finally {
    await browser.close();
  }
}

async function scanPage(
  browser: Browser,
  url: string,
  options: ScanOptions,
): Promise<PageScanResult> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const results = await new AxeBuilder({ page }).withTags([...options.wcagTags]).analyze();
    return {
      url,
      violations: results.violations.map(mapFinding),
      incomplete: results.incomplete.map(mapFinding),
    };
  } finally {
    await context.close();
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
