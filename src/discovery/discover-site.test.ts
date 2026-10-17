import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { discoverSite } from './discover-site.js';

const CRAWL_SITE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/crawl-site',
);

let dir: string;
let server: StaticServer;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfsg-discover-site-test-'));
});

afterEach(async () => {
  await server?.close();
  rmSync(dir, { recursive: true, force: true });
});

function writeSitemap(entries: readonly string[]): void {
  const urls = entries.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n');
  writeFileSync(
    join(dir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    'utf8',
  );
}

describe('discoverSite', () => {
  it('uses the sitemap when present, prepending baseUrl if it is not listed', async () => {
    server = await startStaticServer(dir);
    writeSitemap([`${server.url}/page-1`, `${server.url}/page-2`]);

    const pages = await discoverSite({ baseUrl: server.url, maxPages: 50 });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/page-1`, `${server.url}/page-2`]);
  });

  it('does not duplicate baseUrl when the sitemap already lists it', async () => {
    server = await startStaticServer(dir);
    writeSitemap([`${server.url}/`, `${server.url}/page-1`]);

    const pages = await discoverSite({ baseUrl: server.url, maxPages: 50 });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/page-1`]);
  });

  it('applies excludePaths and the asset filter on the sitemap path', async () => {
    server = await startStaticServer(dir);
    writeSitemap([
      `${server.url}/keep`,
      `${server.url}/private/secret`,
      `${server.url}/brochure.pdf`,
    ]);

    const pages = await discoverSite({
      baseUrl: server.url,
      maxPages: 50,
      excludePaths: ['/private'],
    });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/keep`]);
  });

  it('caps the result at maxPages, keeping baseUrl at the front', async () => {
    server = await startStaticServer(dir);
    writeSitemap([`${server.url}/page-1`, `${server.url}/page-2`, `${server.url}/page-3`]);

    const pages = await discoverSite({ baseUrl: server.url, maxPages: 2 });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/page-1`]);
  });

  it('falls back to a crawl when the site has no sitemap, obeying robots.txt and excludePaths', async () => {
    server = await startStaticServer(CRAWL_SITE_DIR);

    const pages = await discoverSite({
      baseUrl: server.url,
      maxPages: 50,
      excludePaths: ['/excluded-page.html'],
    });

    expect(pages).toEqual([
      `${server.url}/`,
      `${server.url}/about.html`,
      `${server.url}/contact.html`,
    ]);
  });
});

describe('discoverSite — off-origin sitemap entries', () => {
  const PRODUCTION = 'https://www.example.invalid';

  function writeLinkedPages(): void {
    writeFileSync(join(dir, 'index.html'), '<a href="/about.html">About</a>', 'utf8');
    writeFileSync(join(dir, 'about.html'), '<p>About</p>', 'utf8');
  }

  it('warns and crawls instead when every sitemap entry is off-origin', async () => {
    server = await startStaticServer(dir);
    writeLinkedPages();
    writeSitemap([`${PRODUCTION}/`, `${PRODUCTION}/about.html`]);
    const warnings: string[] = [];

    const pages = await discoverSite({
      baseUrl: server.url,
      maxPages: 50,
      onWarning: (message) => warnings.push(message),
    });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/about.html`]);
    expect(warnings).toEqual([
      `Skipped 2 sitemap entries on another origin than ${server.url} (${PRODUCTION}). Set sitemapOrigin (--sitemap-origin) to scan them on ${server.url}.`,
      `The sitemap lists no scannable page on ${server.url}; crawling from ${server.url}.`,
    ]);
  });

  it('warns and keeps the on-origin entries of a mixed sitemap, without crawling', async () => {
    server = await startStaticServer(dir);
    writeLinkedPages();
    writeSitemap([`${server.url}/page-1`, `${PRODUCTION}/page-2`]);
    const warnings: string[] = [];

    const pages = await discoverSite({
      baseUrl: server.url,
      maxPages: 50,
      onWarning: (message) => warnings.push(message),
    });

    // No /about.html: the crawl did not run.
    expect(pages).toEqual([`${server.url}/`, `${server.url}/page-1`]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^Skipped 1 sitemap entry on another origin/);
  });

  it('returns no pages when the sitemap is all off-origin and the crawl is disallowed', async () => {
    server = await startStaticServer(dir);
    writeLinkedPages();
    writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
    writeSitemap([`${PRODUCTION}/about.html`]);

    const pages = await discoverSite({ baseUrl: server.url, maxPages: 50 });

    expect(pages).toEqual([]);
  });

  it('scans the sitemap on baseUrl when sitemapOrigin names its origin, with no warning', async () => {
    server = await startStaticServer(dir);
    writeSitemap([`${PRODUCTION}/`, `${PRODUCTION}/page-1`, `${PRODUCTION}/page-2`]);
    const warnings: string[] = [];

    const pages = await discoverSite({
      baseUrl: server.url,
      maxPages: 50,
      sitemapOrigin: PRODUCTION,
      onWarning: (message) => warnings.push(message),
    });

    expect(pages).toEqual([`${server.url}/`, `${server.url}/page-1`, `${server.url}/page-2`]);
    expect(warnings).toEqual([]);
  });
});
