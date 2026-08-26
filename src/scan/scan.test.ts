import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { scan } from './scan.js';

const FIXTURES_SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/site');

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(FIXTURES_SITE_DIR);
});

afterAll(async () => {
  await server.close();
});

describe('scan', () => {
  it('separates a known violation from a clean page', async () => {
    const result = await scan([`${server.url}/contrast.html`, `${server.url}/clean.html`], {
      wcagTags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    });

    expect(result.pages).toHaveLength(2);

    const [contrastPage, cleanPage] = result.pages;
    expect(contrastPage?.violations.map((v) => v.ruleId)).toEqual(['color-contrast']);
    expect(contrastPage?.violations[0]?.nodes).toHaveLength(1);
    expect(contrastPage?.violations[0]?.impact).toBe('serious');
    expect(cleanPage?.violations).toEqual([]);
    expect(cleanPage?.incomplete).toEqual([]);
  }, 60_000);
});
