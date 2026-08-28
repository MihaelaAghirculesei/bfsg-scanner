import { readFileSync } from 'node:fs';
import type { ImpactValue } from 'axe-core';
import { SCHEMA_VERSION } from '../index.js';
import type { ScanFinding, ScanResult } from '../scan/index.js';
import { clausesFor, compareDotted } from './clauses.js';
import type {
  Report,
  ReportFinding,
  ReportImpactCounts,
  ReportPage,
  ReportSummary,
  ReportTarget,
  ReportToolInfo,
  ReportVerdict,
} from './types.js';
import { countAtOrAbove, type ImpactThreshold } from './verdict.js';

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
  const pages = scanResult.pages.map(enrichPage);
  const summary = summarise(pages);

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    tool,
    target,
    summary,
    verdict: judge(summary, target.failOn),
    pages,
  };
}

/** Attaches the breached WCAG / EN 301 549 clauses to every finding on a scanned page. */
function enrichPage(page: ScanResult['pages'][number]): ReportPage {
  if (page.status === 'error') {
    return page;
  }
  return {
    status: 'ok',
    url: page.url,
    violations: page.violations.map(withClauses),
    incomplete: page.incomplete.map(withClauses),
  };
}

function withClauses(finding: ScanFinding): ReportFinding {
  return { ...finding, clauses: clausesFor(finding.tags) };
}

function judge(summary: ReportSummary, failOn: ImpactThreshold): ReportVerdict {
  const violationsAtOrAboveThreshold = countAtOrAbove(summary.violationsByImpact, failOn);
  return {
    violationsAtOrAboveThreshold,
    unrankedViolations: summary.violationsByImpact.unknown,
    passed: violationsAtOrAboveThreshold === 0,
  };
}

function summarise(pages: readonly ReportPage[]): ReportSummary {
  const byImpact: Record<keyof ReportImpactCounts, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };
  const breachedSuccessCriteria = new Set<string>();
  const breachedEn301549Clauses = new Set<string>();

  let pagesFailed = 0;
  let pagesWithViolations = 0;
  let totalViolations = 0;

  for (const page of pages) {
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
      for (const sc of finding.clauses.wcagSc) {
        breachedSuccessCriteria.add(sc);
      }
      for (const clause of finding.clauses.en301549) {
        breachedEn301549Clauses.add(clause);
      }
    }
  }

  return {
    pagesScanned: pages.length,
    pagesFailed,
    pagesWithViolations,
    totalViolations,
    violationsByImpact: byImpact,
    breachedSuccessCriteria: [...breachedSuccessCriteria].sort(compareDotted),
    breachedEn301549Clauses: [...breachedEn301549Clauses].sort(compareDotted),
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
