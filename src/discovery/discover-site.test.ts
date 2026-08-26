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
