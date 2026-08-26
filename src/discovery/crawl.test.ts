import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type StaticServer, startStaticServer } from '../testing/static-server.js';
import { crawlSite } from './crawl.js';

const CRAWL_SITE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/crawl-site',
);

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(CRAWL_SITE_DIR);
});

afterAll(async () => {
  await server.close();
});

function homeUrl(): string {
  return new URL('/', server.url).toString();
}

describe('crawlSite', () => {
  it('finds every reachable page, honouring robots.txt and excludePaths, dropping assets/mailto/external', async () => {
    const pages = await crawlSite({
      baseUrl: server.url,
      maxPages: 50,
      excludePaths: ['/excluded-page.html'],
    });

    expect(pages).toEqual([homeUrl(), `${server.url}/about.html`, `${server.url}/contact.html`]);
  });

  it('blocks a robots.txt-disallowed page even without an explicit exclude', async () => {
    const pages = await crawlSite({ baseUrl: server.url, maxPages: 50 });

    expect(pages).not.toContain(`${server.url}/disallowed.html`);
    expect(pages).toContain(`${server.url}/excluded-page.html`);
  });

  it('stops at maxPages', async () => {
    const pages = await crawlSite({ baseUrl: server.url, maxPages: 1 });

    expect(pages).toEqual([homeUrl()]);
  });

  it('is deterministic across repeated runs', async () => {
    const first = await crawlSite({ baseUrl: server.url, maxPages: 50 });
    const second = await crawlSite({ baseUrl: server.url, maxPages: 50 });

    expect(second).toEqual(first);
  });
});
