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

// Real axe-core rule tags, so the clause mapping is exercised end to end.
const TAGS: Readonly<Record<string, readonly string[]>> = {
  'color-contrast': ['cat.color', 'wcag2aa', 'wcag143', 'EN-301-549', 'EN-9.1.4.3', 'ACT'],
  'image-alt': ['cat.text-alternatives', 'wcag2a', 'wcag111', 'EN-301-549', 'EN-9.1.1.1'],
  label: ['cat.forms', 'wcag2a', 'wcag412', 'EN-301-549', 'EN-9.4.1.2'],
  'link-name': ['cat.name-role-value', 'wcag2a', 'wcag244', 'wcag412', 'EN-9.2.4.4', 'EN-9.4.1.2'],
};

function finding(ruleId: string, impact: ScanFinding['impact']): ScanFinding {
  return {
    ruleId,
    tags: TAGS[ruleId] ?? [],
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
        breachedSuccessCriteria: [],
        breachedEn301549Clauses: [],
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
      breachedSuccessCriteria: ['1.1.1', '1.4.3'],
      breachedEn301549Clauses: ['9.1.1.1', '9.1.4.3'],
    });
  });

  it('keeps page structure and enriches each finding with its breached clauses', () => {
    const report = build([
      okPage('https://example.de/a', [finding('label', 'critical')]),
      { status: 'error', url: 'https://example.de/b', error: 'net::ERR_ABORTED' },
    ]);

    expect(report.pages[1]).toEqual({
      status: 'error',
      url: 'https://example.de/b',
      error: 'net::ERR_ABORTED',
    });
    const page = report.pages[0];
    expect(page?.status).toBe('ok');
    if (page?.status !== 'ok') {
      return;
    }
    expect(page.violations[0]).toMatchObject({
      ruleId: 'label',
      clauses: { wcagSc: ['4.1.2'], en301549: ['9.4.1.2'] },
    });
  });

  it('maps a finding to every WCAG SC and EN clause its rule carries', () => {
    const report = build([okPage('https://example.de/a', [finding('link-name', 'serious')])]);
    const page = report.pages[0];
    if (page?.status !== 'ok') {
      throw new Error('expected an ok page');
    }

    expect(page.violations[0]?.clauses).toEqual({
      wcagSc: ['2.4.4', '4.1.2'],
      en301549: ['9.2.4.4', '9.4.1.2'],
    });
  });

  it('rolls up distinct breached clauses across pages, ignoring duplicates and incomplete', () => {
    const report = build([
      okPage('https://example.de/a', [finding('color-contrast', 'serious')]),
      okPage('https://example.de/b', [finding('color-contrast', 'serious')]),
      {
        status: 'ok',
        url: 'https://example.de/c',
        violations: [],
        incomplete: [finding('image-alt', null)],
      },
    ]);

    expect(report.summary.breachedSuccessCriteria).toEqual(['1.4.3']);
    expect(report.summary.breachedEn301549Clauses).toEqual(['9.1.4.3']);
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
