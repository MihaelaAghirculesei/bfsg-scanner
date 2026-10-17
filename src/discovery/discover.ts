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
  /**
   * Origin the sitemap was generated for, when it is not baseUrl's — e.g.
   * production, while baseUrl is a local or staging build. Entries (and
   * sub-sitemaps) on this origin are rewritten onto baseUrl's origin,
   * keeping path and query. Defaults to none.
   */
  readonly sitemapOrigin?: string;
  /**
   * Called once, after discovery, with the distinct page entries dropped
   * for being on another origin than baseUrl. Not called when there were none.
   */
  readonly onOffOrigin?: (skippedUrls: readonly string[]) => void;
}

/**
 * Discovers page URLs from a site's sitemap, following a sitemap index to
 * its sub-sitemaps as needed. Off-origin entries are dropped (a sitemap
 * should only ever list its own site, but nothing enforces that) and
 * reported through onOffOrigin, non-page assets and excludePaths matches
 * are filtered out (identically to crawlSite), duplicate URLs are
 * collapsed, and discovery stops as soon as maxPages is reached.
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
    sitemapOrigin,
    onOffOrigin,
  } = options;

  const origin = new URL(baseUrl).origin;
  const rewriteFrom = sitemapOrigin === undefined ? undefined : new URL(sitemapOrigin).origin;
  const rootSitemapUrl = new URL(sitemapPath, baseUrl).toString();

  const collected: string[] = [];
  const offOrigin: string[] = [];
  const seenPages = new Set<string>();
  const visitedSitemaps = new Set<string>();

  await visitSitemap(rootSitemapUrl, 0);

  if (offOrigin.length > 0) {
    onOffOrigin?.(offOrigin);
  }
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
        await visitSitemap(rewriteOrigin(childUrl), depth + 1);
      }
      return;
    }

    for (const listedUrl of doc.urls) {
      if (collected.length >= maxPages) {
        return;
      }
      // Deduplicated after the rewrite, so a sitemap listing a page on both
      // origins yields it once.
      const pageUrl = rewriteOrigin(listedUrl);
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
      if (parsed.origin !== origin) {
        offOrigin.push(pageUrl);
        continue;
      }
      if (!isCrawlableUrl(parsed) || matchesExcludePattern(parsed.pathname, excludePaths)) {
        continue;
      }
      collected.push(pageUrl);
    }
  }

  /** Moves a URL on sitemapOrigin onto baseUrl's origin; any other URL is returned verbatim. */
  function rewriteOrigin(url: string): string {
    if (rewriteFrom === undefined) {
      return url;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return url;
    }
    if (parsed.origin !== rewriteFrom) {
      return url;
    }
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, origin).toString();
  }
}
