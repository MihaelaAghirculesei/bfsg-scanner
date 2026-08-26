import { crawlSite } from './crawl.js';
import { discoverFromSitemap } from './discover.js';
import { SitemapError } from './sitemap.js';

export interface DiscoverSiteOptions {
  readonly baseUrl: string;
  readonly maxPages: number;
  /** Glob patterns matched against a URL pathname; matches are skipped. Defaults to none. */
  readonly excludePaths?: readonly string[];
  /** Injectable for tests; defaults to the global fetch (with User-Agent). */
  readonly fetchFn?: typeof fetch;
}

/**
 * Resolves the list of page URLs to scan for a site.
 *
 * Strategy: prefer the site's sitemap.xml — it is the owner's own
 * declaration of which pages exist. If the root sitemap is missing or
 * unparseable, fall back to a breadth-first crawl from baseUrl.
 *
 * Both strategies apply excludePaths and the non-page-asset filter
 * identically. They differ on robots.txt: the crawl path obeys it (a
 * disallowed page is never fetched, and a disallowed home page yields an
 * empty list), while the sitemap path does not — a URL the owner put in
 * their own sitemap is taken as intended for scanning.
 *
 * On the sitemap path, baseUrl is prepended when the sitemap did not list
 * it, so the home page is always covered; the crawl path already starts
 * from baseUrl. The result never exceeds maxPages.
 */
export async function discoverSite(options: DiscoverSiteOptions): Promise<string[]> {
  const { baseUrl, maxPages, excludePaths = [], fetchFn } = options;
  const shared = { baseUrl, maxPages, excludePaths, ...(fetchFn ? { fetchFn } : {}) };

  try {
    const pages = await discoverFromSitemap(shared);
    return withBaseUrl(pages, baseUrl, maxPages);
  } catch (error) {
    if (!(error instanceof SitemapError)) {
      throw error;
    }
  }

  return crawlSite(shared);
}

function withBaseUrl(pages: readonly string[], baseUrl: string, maxPages: number): string[] {
  const normalized = new URL(baseUrl).toString();
  const alreadyListed = pages.some((page) => {
    try {
      return new URL(page).toString() === normalized;
    } catch {
      return false;
    }
  });

  if (alreadyListed) {
    return [...pages];
  }
  return [normalized, ...pages].slice(0, maxPages);
}
