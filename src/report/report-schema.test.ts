import { readFileSync } from 'node:fs';
import { Ajv2020 as Ajv } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../index.js';
import type { PageScanResult, ScanFinding } from '../scan/index.js';
import { buildReport } from './build.js';
import type { Report, ReportTarget } from './types.js';

const schema = JSON.parse(
  readFileSync(new URL('../../schema/report.v1.json', import.meta.url), 'utf8'),
) as { properties: { schemaVersion: { const: number } } } & Record<string, unknown>;

const ajv = new Ajv({ allErrors: true });
// The schema declares generatedAt as date-time; enforce it here rather than
// pull in ajv-formats.
ajv.addFormat('date-time', (value) => !Number.isNaN(Date.parse(value)));
const validate = ajv.compile<Report>(schema);

const TARGET: ReportTarget = {
  baseUrl: 'https://example.de',
  wcagTags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  failOn: 'serious',
};

function finding(
  ruleId: string,
  impact: ScanFinding['impact'],
  tags: readonly string[],
): ScanFinding {
  return {
    ruleId,
    tags,
    impact,
    description: `${ruleId} description`,
    help: `${ruleId} help`,
    helpUrl: `https://dequeuniversity.com/rules/axe/${ruleId}`,
    nodes: [
      { target: ['#a'], html: '<span></span>', failureSummary: 'Fix this' },
      { target: [['iframe', '#b']], html: '<b></b>', failureSummary: null },
    ],
  };
}

// Exercises every branch of the schema: an ok page with rated and unrated
// violations plus clauses, an ok page with an incomplete result, a clean
// page, and a page that failed to load.
const SCAN_PAGES: PageScanResult[] = [
  {
    status: 'ok',
    url: 'https://example.de/a',
    violations: [
      finding('color-contrast', 'serious', ['wcag2aa', 'wcag143', 'EN-9.1.4.3']),
      finding('some-unrated-rule', null, []),
    ],
    incomplete: [],
  },
  {
    status: 'ok',
    url: 'https://example.de/b',
    violations: [],
    incomplete: [finding('color-contrast', 'serious', ['wcag143', 'EN-9.1.4.3'])],
  },
  { status: 'ok', url: 'https://example.de/c', violations: [], incomplete: [] },
  { status: 'error', url: 'https://example.de/d', error: 'net::ERR_CONNECTION_REFUSED' },
];

const report: Report = buildReport({ pages: SCAN_PAGES }, TARGET, {
  generatedAt: new Date('2026-01-02T03:04:05.000Z'),
  tool: { name: 'bfsg-scanner', version: '9.9.9' },
});

describe('report.v1.json', () => {
  it('validates a report that a real scan can produce', () => {
    if (!validate(report)) {
      throw new Error(
        `report failed schema validation:\n${ajv.errorsText(validate.errors, { separator: '\n' })}`,
      );
    }
  });

  it('rejects an unknown property anywhere (guards against silent drift)', () => {
    expect(validate({ ...report, surprise: true })).toBe(false);
  });

  it('rejects a report missing a required section', () => {
    const { verdict: _dropped, ...withoutVerdict } = report;
    expect(validate(withoutVerdict)).toBe(false);
  });

  it('pins schemaVersion, and the code constant agrees with the schema file', () => {
    expect(validate({ ...report, schemaVersion: 2 })).toBe(false);
    expect(SCHEMA_VERSION).toBe(schema.properties.schemaVersion.const);
  });
});
