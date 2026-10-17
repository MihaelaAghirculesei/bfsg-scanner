import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { discoverFromSitemap } from './discover.js';
import { SitemapError } from './sitemap.js';

let dir: string;
let server: StaticServer;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-discover-test-'));
});

afterEach(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true });
});

/**
 * Synthetic (not real-world) fixtures, purpose-built to exercise index
 * recursion, same-origin filtering and deduplication precisely — unlike
 * sitemap.test.ts, which parses real captured sitemaps.
 */
async function setUpSyntheticSite(): Promise<StaticServer> {
  const started = await startStaticServer(dir);
  const origin = started.url;

  writeFileSync(
    join(dir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${origin}/sitemap-a.xml</loc></sitemap>
  <sitemap><loc>${origin}/sitemap-b.xml</loc></sitemap>
</sitemapindex>`,
    'utf8',
  );

  writeFileSync(
    join(dir, 'sitemap-a.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/page-1</loc></url>
  <url><loc>${origin}/page-2</loc></url>
  <url><loc>https://external.example.invalid/page</loc></url>
</urlset>`,
    'utf8',
  );

  writeFileSync(
    join(dir, 'sitemap-b.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/page-2</loc></url>
  <url><loc>${origin}/page-3</loc></url>
</urlset>`,
    'utf8',
  );

  return started;
}

describe('discoverFromSitemap', () => {
  it('follows a sitemap index, drops off-origin entries, and dedupes pages', async () => {
    server = await setUpSyntheticSite();

    const pages = await discoverFromSitemap({ baseUrl: server.url, maxPages: 50 });

    expect(pages).toEqual([`${server.url}/page-1`, `${server.url}/page-2`, `${server.url}/page-3`]);
  });

  it('stops as soon as maxPages is reached', async () => {
    server = await setUpSyntheticSite();

    const pages = await discoverFromSitemap({ baseUrl: server.url, maxPages: 1 });

    expect(pages).toEqual([`${server.url}/page-1`]);
  });

  it('drops excludePaths matches and non-page assets', async () => {
    server = await startStaticServer(dir);
    const origin = server.url;
    writeFileSync(
      join(dir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/keep</loc></url>
  <url><loc>${origin}/admin/users</loc></url>
  <url><loc>${origin}/report.pdf</loc></url>
</urlset>`,
      'utf8',
    );

    const pages = await discoverFromSitemap({
      baseUrl: origin,
      maxPages: 50,
      excludePaths: ['/admin'],
    });

    expect(pages).toEqual([`${origin}/keep`]);
  });

  it('throws when the root sitemap cannot be loaded', async () => {
    server = await startStaticServer(dir); // empty dir: no sitemap.xml present

    await expect(discoverFromSitemap({ baseUrl: server.url, maxPages: 50 })).rejects.toThrow(
      SitemapError,
    );
  });

  it('skips an unreachable sub-sitemap and keeps the rest', async () => {
    server = await startStaticServer(dir);
    const origin = server.url;

    writeFileSync(
      join(dir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${origin}/missing-sitemap.xml</loc></sitemap>
  <sitemap><loc>${origin}/sitemap-a.xml</loc></sitemap>
</sitemapindex>`,
      'utf8',
    );
    writeFileSync(
      join(dir, 'sitemap-a.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/page-1</loc></url>
</urlset>`,
      'utf8',
    );

    const pages = await discoverFromSitemap({ baseUrl: server.url, maxPages: 50 });

    expect(pages).toEqual([`${origin}/page-1`]);
  });

  it('skips a sub-sitemap that answers with a non-sitemap document and keeps the rest', async () => {
    server = await startStaticServer(dir);
    const origin = server.url;

    writeFileSync(
      join(dir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${origin}/soft-404.xml</loc></sitemap>
  <sitemap><loc>${origin}/sitemap-a.xml</loc></sitemap>
</sitemapindex>`,
      'utf8',
    );
    // Served with 200, like a CMS that renders its "not found" page in place.
    writeFileSync(
      join(dir, 'soft-404.xml'),
      '<!doctype html><html><body><h1>Page not found</h1></body></html>',
      'utf8',
    );
    writeFileSync(
      join(dir, 'sitemap-a.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/page-1</loc></url>
</urlset>`,
      'utf8',
    );

    const pages = await discoverFromSitemap({ baseUrl: server.url, maxPages: 50 });

    expect(pages).toEqual([`${origin}/page-1`]);
  });

  it('throws a SitemapError when the root sitemap is not well-formed XML', async () => {
    server = await startStaticServer(dir);
    writeFileSync(join(dir, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"', 'utf8');

    await expect(discoverFromSitemap({ baseUrl: server.url, maxPages: 50 })).rejects.toThrow(
      SitemapError,
    );
  });

  it('reports the distinct off-origin entries it dropped', async () => {
    server = await setUpSyntheticSite();
    const reported: string[][] = [];

    await discoverFromSitemap({
      baseUrl: server.url,
      maxPages: 50,
      onOffOrigin: (skipped) => reported.push([...skipped]),
    });

    expect(reported).toEqual([['https://external.example.invalid/page']]);
  });

  it('does not report when every entry is on-origin', async () => {
    server = await startStaticServer(dir);
    writeUrlset('sitemap.xml', [`${server.url}/page-1`]);
    let called = false;

    await discoverFromSitemap({
      baseUrl: server.url,
      maxPages: 50,
      onOffOrigin: () => {
        called = true;
      },
    });

    expect(called).toBe(false);
  });

  it('rewrites entries on sitemapOrigin onto the baseUrl origin, keeping path and query', async () => {
    server = await startStaticServer(dir);
    writeUrlset('sitemap.xml', [
      `${PRODUCTION}/`,
      `${PRODUCTION}/about?lang=en`,
      // Listed on both origins: kept once.
      `${server.url}/about?lang=en`,
      'https://elsewhere.example.invalid/page',
    ]);
    const reported: string[][] = [];

    const pages = await discoverFromSitemap({
      baseUrl: server.url,
      maxPages: 50,
      sitemapOrigin: PRODUCTION,
      onOffOrigin: (skipped) => reported.push([...skipped]),
    });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/about?lang=en`]);
    expect(reported).toEqual([['https://elsewhere.example.invalid/page']]);
  });

  it('rewrites sub-sitemap URLs on sitemapOrigin, so the local copies are read', async () => {
    server = await startStaticServer(dir);
    writeFileSync(
      join(dir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${PRODUCTION}/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`,
      'utf8',
    );
    writeUrlset('sitemap-pages.xml', [`${PRODUCTION}/page-1`]);

    const pages = await discoverFromSitemap({
      baseUrl: server.url,
      maxPages: 50,
      sitemapOrigin: `${PRODUCTION}/`,
    });

    expect(pages).toEqual([`${server.url}/page-1`]);
  });
});

/** The origin a staging or local build's sitemap was generated for. */
const PRODUCTION = 'https://www.example.invalid';

function writeUrlset(name: string, entries: readonly string[]): void {
  const urls = entries.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n');
  writeFileSync(
    join(dir, name),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    'utf8',
  );
}
