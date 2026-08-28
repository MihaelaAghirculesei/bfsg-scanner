import { describe, expect, it } from 'vitest';
import type { ScanFinding } from '../scan/index.js';
import { clausesFor } from './clauses.js';
import { messagesFor } from './i18n.js';
import { renderHtmlReport } from './render.js';
import type { Report, ReportFinding, ReportPage } from './types.js';

function finding(
  ruleId: string,
  impact: ScanFinding['impact'],
  tags: readonly string[],
  nodeHtml = '<span></span>',
  failureSummary: string | null = null,
): ReportFinding {
  const base: ScanFinding = {
    ruleId,
    tags,
    impact,
    description: `${ruleId} description`,
    help: `${ruleId} help text`,
    helpUrl: `https://dequeuniversity.com/rules/axe/${ruleId}`,
    nodes: [{ target: ['#node'], html: nodeHtml, failureSummary }],
  };
  return { ...base, clauses: clausesFor(tags) };
}

function report(overrides: Partial<Report> = {}): Report {
  const pages: readonly ReportPage[] = overrides.pages ?? [];
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-02T03:04:05.000Z',
    tool: { name: 'bfsg-scanner', version: '9.9.9' },
    target: { baseUrl: 'https://example.de', wcagTags: ['wcag2a', 'wcag2aa'], failOn: 'serious' },
    summary: {
      pagesScanned: pages.length,
      pagesFailed: 0,
      pagesWithViolations: 0,
      totalViolations: 0,
      violationsByImpact: { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 },
      breachedSuccessCriteria: [],
      breachedEn301549Clauses: [],
      ...overrides.summary,
    },
    verdict: {
      violationsAtOrAboveThreshold: 0,
      unrankedViolations: 0,
      passed: true,
      ...overrides.verdict,
    },
    pages,
  };
}

describe('renderHtmlReport', () => {
  it('produces a self-contained HTML document tagged with the locale', () => {
    const en = renderHtmlReport(report(), 'en');
    expect(en.startsWith('<!doctype html>')).toBe(true);
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('<style>');
    expect(en).not.toContain('<script');
    expect(en).toContain(messagesFor('en').reportTitle);

    expect(renderHtmlReport(report(), 'de')).toContain('<html lang="de">');
  });

  it('shows a passing verdict banner', () => {
    const html = renderHtmlReport(report(), 'en');
    expect(html).toContain('banner pass');
    expect(html).toContain(messagesFor('en').verdictPassed);
  });

  it('shows a failing verdict banner with the count and the unranked note', () => {
    const html = renderHtmlReport(
      report({
        verdict: { violationsAtOrAboveThreshold: 3, unrankedViolations: 2, passed: false },
      }),
      'de',
    );
    expect(html).toContain('banner fail');
    expect(html).toContain(messagesFor('de').verdictFailed);
    expect(html).toContain('3');
    expect(html).toContain(messagesFor('de').unrankedNote);
  });

  it('lists breached clauses as chips with the legal note', () => {
    const html = renderHtmlReport(
      report({
        summary: {
          ...report().summary,
          breachedSuccessCriteria: ['1.4.3', '4.1.2'],
          breachedEn301549Clauses: ['9.1.4.3', '9.4.1.2'],
        },
      }),
      'en',
    );
    expect(html).toContain('>1.4.3<');
    expect(html).toContain('>9.4.1.2<');
    expect(html).toContain(messagesFor('en').clausesLegalNote);
  });

  it('states when nothing was breached', () => {
    expect(renderHtmlReport(report(), 'en')).toContain(messagesFor('en').noClausesBreached);
  });

  it('renders a finding with its rule, impact, clauses and help link', () => {
    const page: ReportPage = {
      status: 'ok',
      url: 'https://example.de/a',
      violations: [finding('color-contrast', 'serious', ['wcag143', 'EN-9.1.4.3'])],
      incomplete: [],
    };
    const html = renderHtmlReport(report({ pages: [page] }), 'en');

    expect(html).toContain('color-contrast');
    expect(html).toContain('serious');
    expect(html).toContain('1.4.3');
    expect(html).toContain('9.1.4.3');
    expect(html).toContain('href="https://dequeuniversity.com/rules/axe/color-contrast"');
  });

  it('escapes rule evidence so a malicious node cannot inject markup', () => {
    const page: ReportPage = {
      status: 'ok',
      url: 'https://example.de/a',
      violations: [
        finding(
          'image-alt',
          'critical',
          ['wcag111'],
          '<img src=x onerror="alert(1)">',
          'Fix <b>this</b>',
        ),
      ],
      incomplete: [],
    };
    const html = renderHtmlReport(report({ pages: [page] }), 'en');

    expect(html).not.toContain('<img src=x onerror=');
    expect(html).toContain('&lt;img src=x onerror=');
    expect(html).toContain('Fix &lt;b&gt;this&lt;/b&gt;');
  });

  it('renders a page that failed to scan with its error', () => {
    const page: ReportPage = {
      status: 'error',
      url: 'https://example.de/down',
      error: 'net::ERR_CONNECTION_REFUSED',
    };
    const html = renderHtmlReport(report({ pages: [page] }), 'de');

    expect(html).toContain(messagesFor('de').pageScanFailed);
    expect(html).toContain('net::ERR_CONNECTION_REFUSED');
  });

  it('renders an empty report without throwing', () => {
    const html = renderHtmlReport(report(), 'en');
    expect(html).toContain(messagesFor('en').summaryHeading);
    expect(html.trim().endsWith('</html>')).toBe(true);
  });

  it('groups incomplete results separately from violations', () => {
    const page: ReportPage = {
      status: 'ok',
      url: 'https://example.de/a',
      violations: [],
      incomplete: [finding('color-contrast', null, ['wcag143'])],
    };
    const html = renderHtmlReport(report({ pages: [page] }), 'en');
    expect(html).toContain(messagesFor('en').incompleteHeading);
    expect(html).toContain(messagesFor('en').incompleteNote);
  });
});
