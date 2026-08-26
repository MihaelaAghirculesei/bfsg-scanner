import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { scan } from './scan.js';

// Mirrors fixtures/SITE_TRUTH.md exactly. If axe-core changes what it
// detects on these pages, this test fails and both files must be updated
// together, with an explanation of what changed and why.
const EXPECTED: Readonly<Record<string, { ruleId: string; nodes: number } | null>> = {
  'clean.html': null,
  'contrast.html': { ruleId: 'color-contrast', nodes: 1 },
  'missing-alt.html': { ruleId: 'image-alt', nodes: 1 },
  'missing-label.html': { ruleId: 'label', nodes: 1 },
  'missing-lang.html': { ruleId: 'html-has-lang', nodes: 1 },
  'unnamed-link.html': { ruleId: 'link-name', nodes: 1 },
};

const FIXTURES_SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/site');

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(FIXTURES_SITE_DIR);
});

afterAll(async () => {
  await server.close();
});

describe('scan (golden fixture site)', () => {
  it('reproduces fixtures/SITE_TRUTH.md exactly', async () => {
    const pageNames = Object.keys(EXPECTED);
    const result = await scan(
      pageNames.map((name) => `${server.url}/${name}`),
      { wcagTags: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
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
        expect(outcome.violations[0]?.nodes, name).toHaveLength(expected.nodes);
      }
      expect(outcome.incomplete, `${name} should have no incomplete results`).toEqual([]);
    });
  }, 60_000);
});
