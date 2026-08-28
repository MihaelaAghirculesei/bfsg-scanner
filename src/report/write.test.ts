import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Report } from './types.js';
import { REPORT_FILENAME, writeReport } from './write.js';

const REPORT: Report = {
  schemaVersion: 1,
  generatedAt: '2026-01-02T03:04:05.000Z',
  tool: { name: 'bfsg-scanner', version: '9.9.9' },
  target: { baseUrl: 'https://example.de', wcagTags: ['wcag2aa'], failOn: 'serious' },
  summary: {
    pagesScanned: 0,
    pagesFailed: 0,
    pagesWithViolations: 0,
    totalViolations: 0,
    violationsByImpact: { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 },
    breachedSuccessCriteria: [],
    breachedEn301549Clauses: [],
  },
  verdict: { violationsAtOrAboveThreshold: 0, unrankedViolations: 0, passed: true },
  pages: [],
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-report-write-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('writeReport', () => {
  it('writes pretty-printed JSON to <dir>/report.json and returns the path', async () => {
    const path = await writeReport(REPORT, dir);

    expect(path).toBe(join(dir, REPORT_FILENAME));
    const raw = readFileSync(path, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('  "schemaVersion": 1');
    expect(JSON.parse(raw)).toEqual(REPORT);
  });

  it('creates the output directory if it does not exist', async () => {
    const nested = join(dir, 'deep', 'nested', 'out');

    const path = await writeReport(REPORT, nested);

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(REPORT);
  });

  it('overwrites a report from a previous run', async () => {
    await writeReport({ ...REPORT, summary: { ...REPORT.summary, totalViolations: 5 } }, dir);
    await writeReport(REPORT, dir);

    const written = JSON.parse(readFileSync(join(dir, REPORT_FILENAME), 'utf8')) as Report;
    expect(written.summary.totalViolations).toBe(0);
  });
});
