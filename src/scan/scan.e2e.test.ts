import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clausesFor } from '../report/clauses.js';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { scan } from './scan.js';

// Mirrors fixtures/SITE_TRUTH.md exactly. If axe-core changes what it
// detects on these pages — the rule, the node count, or the WCAG / EN
// 301 549 clauses its tags map to — this test fails and both files must be
// updated together, with an explanation of what changed and why.
interface ExpectedFinding {
  readonly ruleId: string;
  readonly nodes: number;
  readonly wcagSc: readonly string[];
  readonly en301549: readonly string[];
}

const EXPECTED: Readonly<Record<string, ExpectedFinding | null>> = {
  'clean.html': null,
  'contrast.html': {
    ruleId: 'color-contrast',
    nodes: 1,
    wcagSc: ['1.4.3'],
    en301549: ['9.1.4.3'],
  },
  'missing-alt.html': {
    ruleId: 'image-alt',
    nodes: 1,
    wcagSc: ['1.1.1'],
    en301549: ['9.1.1.1'],
  },
  'missing-label.html': {
    ruleId: 'label',
    nodes: 1,
    wcagSc: ['4.1.2'],
    en301549: ['9.4.1.2'],
  },
  'missing-lang.html': {
    ruleId: 'html-has-lang',
    nodes: 1,
    wcagSc: ['3.1.1'],
    en301549: ['9.3.1.1'],
  },
  'unnamed-link.html': {
    ruleId: 'link-name',
    nodes: 1,
    wcagSc: ['2.4.4', '4.1.2'],
    en301549: ['9.2.4.4', '9.4.1.2'],
  },
};

const FIXTURES_SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/site');

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

describe('scan (golden fixture site)', () => {
  it('reproduces fixtures/SITE_TRUTH.md exactly', async () => {
    const pageNames = Object.keys(EXPECTED);
    const result = await scan(
      pageNames.map((name) => `${server.url}/${name}`),
      {
        wcagTags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        // All 6 pages share one host; this test cares about correctness,
        // not the production rate limit's pacing.
        hostRateLimitMs: 0,
      },
      { browser },
    );

    expect(result.pages).toHaveLength(pageNames.length);

    pageNames.forEach((name, index) => {
      const outcome = result.pages[index];
      const expected = EXPECTED[name] ?? null;

      expect(outcome?.status, `${name} should scan successfully`).toBe('ok');
      if (outcome?.status !== 'ok') {
        return;
      }

      if (expected === null) {
        expect(outcome.violations, `${name} should have no violations`).toEqual([]);
      } else {
        expect(
          outcome.violations.map((v) => v.ruleId),
          name,
        ).toEqual([expected.ruleId]);
        const violation = outcome.violations[0];
        expect(violation?.nodes, name).toHaveLength(expected.nodes);
        expect(clausesFor(violation?.tags ?? []), `${name} clause mapping`).toEqual({
          wcagSc: expected.wcagSc,
          en301549: expected.en301549,
        });
      }
      expect(outcome.incomplete, `${name} should have no incomplete results`).toEqual([]);
    });
  }, 60_000);
});
