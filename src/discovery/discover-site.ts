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
  /** Receives one line per discovery problem worth surfacing. Defaults to none. */
  readonly onWarning?: (message: string) => void;
}

/**
 * Resolves the list of page URLs to scan for a site.
 *
 * Strategy: prefer the site's sitemap.xml — it is the owner's own
 * declaration of which pages exist. If the root sitemap is missing or
 * unparseable, or lists no scannable page on baseUrl's origin, fall back
 * to a breadth-first crawl from baseUrl.
 *
 * Sitemap entries on another origin are dropped with a warning: they are
 * the typical sign of a local or staging build whose sitemap points at
 * production, and dropping them silently would leave a scan of the home
 * page alone looking like a clean site.
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
  const { baseUrl, maxPages, excludePaths = [], fetchFn, onWarning } = options;
  const shared = { baseUrl, maxPages, excludePaths, ...(fetchFn ? { fetchFn } : {}) };
  const origin = new URL(baseUrl).origin;

  try {
    const pages = await discoverFromSitemap({
      ...shared,
      onOffOrigin: (skipped) => onWarning?.(describeOffOrigin(skipped, origin)),
    });
    if (pages.length > 0) {
      return withBaseUrl(pages, baseUrl, maxPages);
    }
    onWarning?.(`The sitemap lists no scannable page on ${origin}; crawling from ${baseUrl}.`);
  } catch (error) {
    if (!(error instanceof SitemapError)) {
      throw error;
    }
  }

  return crawlSite(shared);
}

function describeOffOrigin(skipped: readonly string[], origin: string): string {
  const origins = [...new Set(skipped.map((url) => new URL(url).origin))];
  const shown = origins.length > 3 ? [...origins.slice(0, 3), '…'] : origins;
  const entries = skipped.length === 1 ? 'entry' : 'entries';
  return `Skipped ${skipped.length} sitemap ${entries} on another origin than ${origin} (${shown.join(', ')}).`;
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
