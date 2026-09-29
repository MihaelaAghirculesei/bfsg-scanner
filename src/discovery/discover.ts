import { fetchWithUserAgent } from '../shared/user-agent.js';
import { isCrawlableUrl, matchesExcludePattern } from './links.js';
import { parseSitemapXml, type SitemapDocument, SitemapError } from './sitemap.js';

export interface DiscoverFromSitemapOptions {
  readonly baseUrl: string;
  readonly maxPages: number;
  /** Path to the root sitemap, relative to baseUrl. Defaults to "/sitemap.xml". */
  readonly sitemapPath?: string;
  /** Glob patterns matched against a URL pathname; matches are skipped. Defaults to none. */
  readonly excludePaths?: readonly string[];
  /** Injectable for tests; defaults to the global fetch. */
  readonly fetchFn?: typeof fetch;
  /** Guards against pathological or cyclic sitemap indexes. Defaults to 3. */
  readonly maxSitemapDepth?: number;
}

/**
 * Discovers page URLs from a site's sitemap, following a sitemap index to
 * its sub-sitemaps as needed. Off-origin entries are dropped (a sitemap
 * should only ever list its own site, but nothing enforces that), non-page
 * assets and excludePaths matches are filtered out (identically to
 * crawlSite), duplicate URLs are collapsed, and discovery stops as soon as
 * maxPages is reached.
 *
 * A failure to load or parse the root sitemap is fatal and always surfaces
 * as a SitemapError (the caller should fall back to crawling). A failure on
 * a sub-sitemap referenced by an index is not: that one sub-sitemap is
 * skipped and discovery continues with the rest.
 */
export async function discoverFromSitemap(options: DiscoverFromSitemapOptions): Promise<string[]> {
  const {
    baseUrl,
    maxPages,
    sitemapPath = '/sitemap.xml',
    excludePaths = [],
    fetchFn = fetchWithUserAgent,
    maxSitemapDepth = 3,
  } = options;

  const origin = new URL(baseUrl).origin;
  const rootSitemapUrl = new URL(sitemapPath, baseUrl).toString();

  const collected: string[] = [];
  const seenPages = new Set<string>();
  const visitedSitemaps = new Set<string>();

  await visitSitemap(rootSitemapUrl, 0);

  return collected.slice(0, maxPages);

  async function visitSitemap(sitemapUrl: string, depth: number): Promise<void> {
    if (collected.length >= maxPages) {
      return;
    }
    if (visitedSitemaps.has(sitemapUrl) || depth > maxSitemapDepth) {
      return;
    }
    visitedSitemaps.add(sitemapUrl);

    // Parsing sits inside the same guard as the fetch: a URL that answers
    // 200 with something other than a sitemap (a soft-404 HTML page, a
    // truncated file) is as unusable as one that answers 404, and must be
    // skipped the same way rather than abort the whole sitemap.
    let doc: SitemapDocument;
    try {
      const response = await fetchFn(sitemapUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      doc = parseSitemapXml(await response.text());
    } catch (cause) {
      if (depth === 0) {
        throw new SitemapError(
          `Cannot load sitemap at "${sitemapUrl}": ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
      return;
    }

    if (doc.kind === 'sitemapindex') {
      for (const childUrl of doc.sitemaps) {
        if (collected.length >= maxPages) {
          return;
        }
        await visitSitemap(childUrl, depth + 1);
      }
      return;
    }

    for (const pageUrl of doc.urls) {
      if (collected.length >= maxPages) {
        return;
      }
      if (seenPages.has(pageUrl)) {
        continue;
      }
      seenPages.add(pageUrl);

      let parsed: URL;
      try {
        parsed = new URL(pageUrl);
      } catch {
        continue;
      }
      if (
        parsed.origin !== origin ||
        !isCrawlableUrl(parsed) ||
        matchesExcludePattern(parsed.pathname, excludePaths)
      ) {
        continue;
      }
      collected.push(pageUrl);
    }
  }
}
