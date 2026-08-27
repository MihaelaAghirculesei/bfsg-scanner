import { readFileSync } from 'node:fs';
import type { ImpactValue } from 'axe-core';
import { SCHEMA_VERSION } from '../index.js';
import type { ScanResult } from '../scan/index.js';
import type {
  Report,
  ReportImpactCounts,
  ReportSummary,
  ReportTarget,
  ReportToolInfo,
} from './types.js';

export interface BuildReportOptions {
  /** Overrides the generated-at timestamp; defaults to now. Injectable for tests. */
  readonly generatedAt?: Date;
  /** Overrides tool name/version; defaults to package.json. Injectable for tests. */
  readonly tool?: ReportToolInfo;
}

/**
 * Assembles a versioned, self-describing report from a scan result. Pure
 * apart from the default clock and the one-time package.json read, both of
 * which can be overridden via options.
 */
export function buildReport(
  scanResult: ScanResult,
  target: ReportTarget,
  options: BuildReportOptions = {},
): Report {
  const { generatedAt = new Date(), tool = readToolInfo() } = options;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    tool,
    target,
    summary: summarise(scanResult),
    pages: scanResult.pages,
  };
}

function summarise(scanResult: ScanResult): ReportSummary {
  const byImpact: Record<keyof ReportImpactCounts, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };

  let pagesFailed = 0;
  let pagesWithViolations = 0;
  let totalViolations = 0;

  for (const page of scanResult.pages) {
    if (page.status === 'error') {
      pagesFailed += 1;
      continue;
    }
    if (page.violations.length > 0) {
      pagesWithViolations += 1;
    }
    totalViolations += page.violations.length;
    for (const finding of page.violations) {
      byImpact[impactBucket(finding.impact)] += 1;
    }
  }

  return {
    pagesScanned: scanResult.pages.length,
    pagesFailed,
    pagesWithViolations,
    totalViolations,
    violationsByImpact: byImpact,
  };
}

function impactBucket(impact: ImpactValue): keyof ReportImpactCounts {
  switch (impact) {
    case 'critical':
    case 'serious':
    case 'moderate':
    case 'minor':
      return impact;
    default:
      return 'unknown';
  }
}

function readToolInfo(): ReportToolInfo {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    name?: string;
    version?: string;
  };
  return { name: pkg.name ?? 'bfsg-scanner', version: pkg.version ?? '0.0.0' };
}
