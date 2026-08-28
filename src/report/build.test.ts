import { describe, expect, it } from 'vitest';
import type { PageScanResult, ScanFinding, ScanResult } from '../scan/index.js';
import { buildReport } from './build.js';
import type { ReportTarget } from './types.js';

const FIXED_AT = new Date('2026-01-02T03:04:05.000Z');
const TOOL = { name: 'bfsg-scanner', version: '9.9.9' };
const TARGET: ReportTarget = {
  baseUrl: 'https://example.de',
  wcagTags: ['wcag2aa'],
  failOn: 'serious',
};

function finding(ruleId: string, impact: ScanFinding['impact']): ScanFinding {
  return {
    ruleId,
    impact,
    description: `${ruleId} description`,
    help: `${ruleId} help`,
    helpUrl: `https://dequeuniversity.com/rules/axe/${ruleId}`,
    nodes: [{ target: ['#node'], html: '<span></span>', failureSummary: null }],
  };
}

function okPage(url: string, violations: ScanFinding[]): PageScanResult {
  return { status: 'ok', url, violations, incomplete: [] };
}

function build(pages: PageScanResult[]) {
  return buildReport({ pages } satisfies ScanResult, TARGET, {
    generatedAt: FIXED_AT,
    tool: TOOL,
  });
}

describe('buildReport', () => {
  it('produces an empty summary for an empty scan', () => {
    const report = build([]);

    expect(report).toEqual({
      schemaVersion: 1,
      generatedAt: '2026-01-02T03:04:05.000Z',
      tool: TOOL,
      target: TARGET,
      summary: {
        pagesScanned: 0,
        pagesFailed: 0,
        pagesWithViolations: 0,
        totalViolations: 0,
        violationsByImpact: { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 },
      },
      verdict: {
        violationsAtOrAboveThreshold: 0,
        unrankedViolations: 0,
        passed: true,
      },
      pages: [],
    });
  });

  it('counts pages, violations and impact buckets across a mixed result', () => {
    const report = build([
      okPage('https://example.de/a', [
        finding('color-contrast', 'serious'),
        finding('image-alt', 'critical'),
      ]),
      okPage('https://example.de/b', []),
      { status: 'error', url: 'https://example.de/c', error: 'net::ERR_ABORTED' },
      okPage('https://example.de/d', [finding('weird-rule', null)]),
    ]);

    expect(report.summary).toEqual({
      pagesScanned: 4,
      pagesFailed: 1,
      pagesWithViolations: 2,
      totalViolations: 3,
      violationsByImpact: { critical: 1, serious: 1, moderate: 0, minor: 0, unknown: 1 },
    });
  });

  it('passes page results through verbatim', () => {
    const pages = [okPage('https://example.de/a', [finding('label', 'critical')])];

    expect(build(pages).pages).toEqual(pages);
  });

  it('defaults generatedAt to a valid current ISO timestamp', () => {
    const before = Date.now();
    const report = buildReport({ pages: [] }, TARGET, { tool: TOOL });

    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);
    expect(Date.parse(report.generatedAt)).toBeGreaterThanOrEqual(before);
  });
});

describe('buildReport verdict', () => {
  function verdictFor(failOn: ReportTarget['failOn'], violations: ScanFinding[]) {
    return buildReport(
      { pages: [okPage('https://example.de/a', violations)] },
      { ...TARGET, failOn },
      {
        generatedAt: FIXED_AT,
        tool: TOOL,
      },
    ).verdict;
  }

  it('passes when nothing reaches the threshold', () => {
    expect(verdictFor('critical', [finding('color-contrast', 'serious')])).toEqual({
      violationsAtOrAboveThreshold: 0,
      unrankedViolations: 0,
      passed: true,
    });
  });

  it('fails on a violation at the threshold', () => {
    expect(verdictFor('serious', [finding('color-contrast', 'serious')])).toEqual({
      violationsAtOrAboveThreshold: 1,
      unrankedViolations: 0,
      passed: false,
    });
  });

  it('fails on a violation above the threshold', () => {
    expect(verdictFor('serious', [finding('image-alt', 'critical')])).toEqual({
      violationsAtOrAboveThreshold: 1,
      unrankedViolations: 0,
      passed: false,
    });
  });

  it('reports unranked violations separately without failing on them', () => {
    expect(verdictFor('minor', [finding('weird-rule', null)])).toEqual({
      violationsAtOrAboveThreshold: 0,
      unrankedViolations: 1,
      passed: true,
    });
  });

  it('is scoped to scanned pages: a failed page cannot fail the verdict', () => {
    const report = buildReport(
      { pages: [{ status: 'error', url: 'https://example.de/a', error: 'boom' }] },
      TARGET,
      { generatedAt: FIXED_AT, tool: TOOL },
    );

    expect(report.summary.pagesFailed).toBe(1);
    expect(report.verdict.passed).toBe(true);
  });
});
